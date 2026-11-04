---
title: Vivarium beasts
description: Keep beasts in a room's four vivariums, referee the moves, harvests and breeds players make with the game's beast screens, and save the beasts with the room.
sidebar:
  order: 580
---

A Room of Requirement has four vivariums, `Forest`, `Swamp`, `Coastal` and `Grassland`. Each is an island of the room, which players reach once its biome is [open](/guides/room-of-requirement/unlocks/#the-rooms-locks). A room keeps the beasts living in its vivariums as part of its layout, and the server runs their lives the game's way: their byproducts fill, players feed and pet them and collect what they make, feeders feed them, and pairs breed at pens. Everyone in the room sees the same beasts, and their game counts them as its own vivarium beasts.

Your script puts beasts in, decides which of the players' moves, harvests and breeds go through, and saves the beasts with the rest of the room.

## The beasts in a room

Each vivarium holds at most 12 beasts of at most 4 species. A young counts as its adult's species, so Mooncalves and their calves are one.

| Call | What it does |
| --- | --- |
| `Sanctuary.beasts(id, vivarium?)` | The beasts living in a loaded room, or in one of its vivariums, as `Beast`s. Empty when no room is loaded under that id |
| `Sanctuary.addBeast(id, vivarium, beast)` | Puts a beast into a vivarium, as if an editor had released it there, and returns it. `null` when the room is not loaded or the vivarium has no room for it |

`addBeast` takes the beast as a [layout entry](#what-a-beast-entry-holds), of which it needs only `species`: the vivarium is the argument's, and the room gives the beast the next free `id`. It throws for an entry `load` would refuse, such as an unknown species, a colour the species does not have or a name over 64 UTF-8 bytes. A beast placed without a position starts at a spot on its vivarium's island. `addBeast` raises `sanctuaryChanged`.

This puts a beast in a player's room as a reward, if its vivarium has room:

```jsx
// server/main.js
function giveRoomBeast(player, species, vivarium) {
  const beast = Sanctuary.addBeast(roomOf(player), vivarium, { species });
  if (beast) player.sendChat(`A ${species} moved into your ${vivarium} vivarium.`);
  else player.sendChat(`Your ${vivarium} vivarium has no room for a ${species}.`);
  return beast;
}
```

`roomOf` is the room id from [Rooms](/guides/room-of-requirement/rooms/#loading-a-room).

Every other `Beast` call works on these beasts too, such as [movement](/guides/npcs-and-creatures/movement/#beasts) and `addHappiness`. Destroying one takes it out of the room, and so does a catch, which can only happen if a script makes the beast `capturable`. Unloading the room despawns its beasts.

Five members say where a beast lives and how it is doing. On a beast that lives in no vivarium they are `null`:

| Member | Meaning |
| --- | --- |
| `beast.room` | The room it lives in |
| `beast.vivarium` | The vivarium it lives in |
| `beast.byproduct` | Its byproduct, from 0 to 1 ([the cycle](#the-byproduct-cycle)). Assignable |
| `beast.needs` | `{ fed, petted }`: its needs met this cycle. Assigning sets the fields given |
| `beast.pregnancy` | A mother's pregnancy ([Breeding](#breeding)) |

Assigning `byproduct` or `needs` throws on a beast that lives in no vivarium, and `byproduct` takes only a number from 0 to 1.

### Starting a room with beasts

A layout carries its beasts, so a new room can start with some. This gives every new room a pair of Mooncalves in its Grassland vivarium:

```jsx
// server/main.js
// An entry needs only its vivarium and species; the rest has defaults.
const STARTERS = [
  { vivarium: "Grassland", species: "Mooncalf", gender: "female", name: "Clover" },
  { vivarium: "Grassland", species: "Mooncalf", gender: "male", name: "Moss" },
];

function openNewRoom(id) {
  Sanctuary.load(id, { version: 2, objects: [], locks: roomLocks, lighting: "Default", beasts: STARTERS });
}
```

`roomLocks` stands for the room's locks, such as `ALL_OPEN` from [Wings, vivariums and recipes](/guides/room-of-requirement/unlocks/#the-rooms-locks). The Grassland biome has to be open for players to reach the pair. Call `openNewRoom` only for a room with nothing saved: loading it over a saved room replaces that room, beasts and all.

## Moving beasts

Standing in a vivarium, a room's editors move beasts with the game's own beast screens:

| `move.kind` | The move |
| --- | --- |
| `"release"` | A beast from the player's bag into the vivarium they stand in |
| `"take"` | A beast from the vivarium into the player's bag |
| `"free"` | A beast from the vivarium back to the wild. It leaves the room for good |
| `"summon"` | A beast to the player, from any of the room's vivariums into the one they stand in |

Each move is held in the player's game until the server answers. Only the room's [editors](/guides/room-of-requirement/rooms/#decorating) can move its beasts, and anyone else's move is refused before scripts hear of it. The server also checks that the player stands in the vivarium the move needs, that the beast lives in their room or, for a release, that their bag holds it, and that a vivarium the beast moves into has room. It rate-limits the requests each client sends. Then `vivariumMove(player, move)` fires. It runs synchronously, and a handler that returns `false` refuses the move: the beast stays where it was.

`move.room` is the room. `move.vivarium` is where the beast goes for a release or a summon, and where it lives for a take or a free. `move.beast` is the `Beast` moved, or `null` for a release, whose bag entry is `move.captured`. A released or summoned beast appears 2.5 m in front of the player, facing them. Each move that goes through raises `sanctuaryChanged` with the player as the editor.

This keeps beasts in their room: nobody frees one, and only the room's owner takes one away:

```js
// server/main.js
Events.on("vivariumMove", (player, move) => {
  if (move.kind === "free") {
    player.sendChat("The beasts here stay here.");
    return false;
  }
  if (move.kind === "take" && move.room !== roomOf(player)) {
    player.sendChat("Only the room's owner can take its beasts away.");
    return false;
  }
});
```

### Beasts and the bag

A release takes the beast out of the player's [bag](/guides/npcs-and-creatures/catching-beasts/#the-bag), and a take puts one in. Neither raises `beastReleased` or `beastCaptured`, so a server that keeps bags saves them after these moves as well. The move is applied once every handler has allowed it, so save a moment later:

```js
// server/main.js
Events.on("vivariumMove", (player, move) => {
  if (move.kind === "release" || move.kind === "take") setTimeout(() => keepBag(player), 0);
});
```

`keepBag` is from [Keeping catches](/guides/npcs-and-creatures/catching-beasts/#keeping-catches). A refused move leaves the bag as it was, so saving it again does no harm.

## Feeding, petting and byproducts

### The byproduct cycle

Every vivarium beast makes its species' byproduct on the game's cycle. Its `byproduct` fills from 0 to 1 over 25 minutes, whatever its needs, and the moment it is full both its needs clear. Players then feed it and pet it, and with both needs met any player in the room standing beside it can collect the byproduct. Collecting sets it back to 0 and the cycle starts again.

Each need is met once a cycle, and stays met until the byproduct fills again. So a beast is fed, petted and collected from once every 25 minutes.

### Petting and feeding

Players pet a vivarium beast with the game's brush and feed it with creature feed, as they do any [beast](/guides/npcs-and-creatures/beasts-and-characters/#care-and-happiness), and `beastCared` can refuse the care. An accepted care meets that need, adds the game's 11 happiness and raises `sanctuaryChanged` with the player. A care whose need is already met this cycle is turned away before `beastCared` fires. Any player in reach may care for the beasts, visitors included, unless your `beastCared` handler says otherwise.

### Feeders

A beast feeder conjured on a vivarium's island feeds that vivarium's beasts, as in the game. Players conjure one with the `Transfiguration_Category_Biome_BeastFeedingStationLarge` [recipe](/guides/room-of-requirement/unlocks/#conjuration-recipes). The game running a beast's AI walks it over to eat, and the meal meets its fed need with the game's 11 happiness, shows the eating to every player and raises `sanctuaryChanged` with no editor. A meal is not a player's care, so it raises no `beastCared` and a script cannot refuse it.

A beast no player's game runs, whose `ownerId` is 0, is fed by a feeder in its vivarium within a few seconds, without `sanctuaryChanged`. A room loaded a minute or more after it was saved has its beasts in vivariums with a feeder fed too. Feeders hold no stock, so there is nothing for a script to fill.

### Collecting the byproduct

When a player collects a byproduct, their game holds the harvest until the server answers. The server checks that the player is alive, in the beast's room and within 10 m of it, and that both needs are met and the byproduct is full. Then `beastByproductRequest(beast, player)` fires. It runs synchronously, and a handler that returns `false` refuses the harvest: nothing changes.

Allowed, the player's inventory gets the species' byproduct ([Species](#species) lists them), the byproduct goes back to 0, and `beastByproductCollected(beast, player, item, count)` fires, followed by `sanctuaryChanged` with the player. If the inventory refuses the items, the harvest is refused and the byproduct stays ready.

The count is the same whatever the beast's happiness. This lets only a room's editors collect, and gives one more from a beast at 90 happiness or above:

```js
// server/main.js
Events.on("beastByproductRequest", (beast, player) => {
  if (!beast.room || !Sanctuary.editors(beast.room).some((editor) => editor.id === player.id)) {
    player.sendChat("Only the room's builders collect from its beasts.");
    return false;
  }
});

Events.on("beastByproductCollected", (beast, player, item) => {
  if (beast.happiness < 90) return;
  player.inventory.give(item, 1);
  player.sendChat(`Your ${beast.name || beast.species} is so content it gave one more.`);
});
```

To make a beast ready at once, set `beast.byproduct = 1` and `beast.needs = { fed: true, petted: true }`. A byproduct you set to full leaves the needs as they are. Neither assignment raises `sanctuaryChanged`.

## Breeding

A breeding pen conjured on a vivarium's island breeds that vivarium's beasts. Players conjure one with the `Transfiguration_Category_Biome_CreaturePen` [recipe](/guides/room-of-requirement/unlocks/#conjuration-recipes). An editor standing at the pen picks a female and a male of one species on its screen, and their game holds the breed until the server answers. The server checks that:

- the player is alive and an editor of the room they are in;
- both beasts live in that room, in one vivarium, and are adults of a species that breeds, a female and a male;
- the female is not already carrying;
- the pen is one of the room's, on the same island and within 30 m of the player, and no other mother is using it;
- the vivarium has room for one more beast of the species.

Then `beastBreedRequest(player, mother, father)` fires, with the female as the mother whichever way round the screen named them. It runs synchronously, and a handler that returns `false` refuses the breed. Allowed, the server rolls the young's sex, at even odds, and its colour from the parents' colours on the game's breeding table, and the mother carries it. `sanctuaryChanged` fires with the player.

A live-bearer gives birth after 30 minutes. An egg-layer carries the young for 15 minutes, then lays the egg in the pen and sits on it for 15 more until it hatches. The young appears beside the pen and joins the room, `beastBorn(mother, child)` fires, and `sanctuaryChanged` follows with no editor. If the vivarium has filled up in the meantime, the birth waits until it has room. A young stays young: it never grows into an adult.

`beast.pregnancy` reads a mother's pregnancy, and is `null` for any other beast. Every player's pen screen and the mother show it as the game would.

| Field | Meaning |
| --- | --- |
| `stage` | `"gestation"` while she carries the young, `"incubation"` while an egg-layer sits on the egg |
| `pen` | The pen's `uid` among the room's objects |
| `father` | The father, or `null` once he has left the room |
| `endsIn` | Seconds left in the stage |

This lets a room raise four young at a time, counting the ones on the way, and tells everyone in the room about a birth:

```js
// server/main.js
const MAX_YOUNG = 4;

Events.on("beastBreedRequest", (player, mother) => {
  if (!mother.room) return;
  const young = Sanctuary.beasts(mother.room).filter((beast) => beast.species.endsWith("Offspring") || beast.pregnancy);
  if (young.length >= MAX_YOUNG) {
    player.sendChat(`This room is already raising ${MAX_YOUNG} young.`);
    return false;
  }
});

Events.on("beastBorn", (mother, child) => {
  if (!mother.room) return;
  for (const player of Sanctuary.occupants(mother.room)) {
    player.sendChat(`${mother.name || mother.species} had a ${child.gender} ${child.species}.`);
  }
});
```

## Species

The 13 species, what a harvest of each gives, and how each breeds. A species' young is its id with `Offspring` added, such as `MooncalfOffspring`.

| Species | Byproduct | Per harvest | Breeding |
| --- | --- | --- | --- |
| `Diricawl` | `Diricawl_Byproduct` | 3 | Egg |
| `Fwooper` | `Fwooper_Byproduct` | 3 | Egg |
| `GiantPurpleToad` | `Toad_Byproduct` | 3 | Egg |
| `Graphorn` | `Graphorn_Byproduct` | 3 | Live |
| `Hippogriff` | `Hippogriff_Byproduct` | 3 | Egg |
| `Jobberknoll` | `Jobberknoll_Byproduct` | 5 | Egg |
| `Kneazle` | `Kneazle_Byproduct` | 3 | Live |
| `Mooncalf` | `Mooncalf_Byproduct` | 5 | Live |
| `Niffler` | `Niffler_Byproduct` | 3 | Egg |
| `Phoenix` | `Phoenix_Byproduct` | 3 | Does not breed |
| `Puffskein` | `Puffskein_Byproduct` | 3 | Live |
| `Thestral` | `Thestral_Byproduct` | 3 | Live |
| `Unicorn` | `Unicorn_Byproduct` | 3 | Live |

An egg-layer carries for 15 minutes and sits on the egg for 15; a live-bearer carries for 30.

## Saving the beasts

The beasts belong to the layout, so the save in [Rooms](/guides/room-of-requirement/rooms/#saving-rooms) keeps them. `Sanctuary.get` reads each beast's position, happiness, needs, byproduct and pregnancy as they are now. `sanctuaryChanged` fires for these changes to a room's beasts:

| Change | `editor` |
| --- | --- |
| `addBeast` put a beast in | `null` |
| An editor's move went through | The editor |
| A player's care counted | The player |
| A beast ate at a feeder, in the game running it | `null` |
| A breed went through | The player |
| A harvest went through | The player |
| A young was born | `null` |
| A beast left the world: a script destroyed it, or a player caught it | `null` |

The revision moves when a beast joins the room, leaves it or changes vivarium, and stays as it was for the others.

Some changes raise nothing: a byproduct filling and the needs it clears, a feeder feeding a beast no game runs, an egg being laid, beasts walking about, and your own `byproduct`, `needs` and `addHappiness`. The next save picks them up, and time away is not lost. Each beast's `updatedAt` stamps when its byproduct was read, and `load` advances the byproduct by the time since, on the same 25-minute cycle. A room saved yesterday comes back with every byproduct full. A beast whose byproduct filled while the room was stored has its needs cleared, and its fed need met again if its vivarium has a feeder. A pregnancy keeps the time its stage began, so a mother whose time ran out while the room was stored gives birth as soon as it loads.

Loading a layout into a loaded room keeps each beast whose `id` the layout holds as the same `Beast`, and moves it if the layout's position differs. A beast whose species, gender, name or colour the layout changes is replaced by a new `Beast`, and beasts the layout leaves out leave the room. A layout without `beasts`, such as a version 1 layout, empties every vivarium. `Sanctuary.unload` despawns the room's beasts, so save the room before you unload it.

## What a beast entry holds

`layout.beasts` lists the beasts in all four vivariums. `Sanctuary.get` writes every field, and `pregnancy` only for a mother. `load` needs only `vivarium` and `species`, and `addBeast` only `species`:

| Field | Holds |
| --- | --- |
| `id` | A whole number unique within the room. Left out, `load` numbers the beast after the highest id. `addBeast` always numbers it |
| `vivarium` | `"Forest"`, `"Swamp"`, `"Coastal"` or `"Grassland"` |
| `species` | The game's species id, an adult or a young, as `Beast.catalog()` lists them |
| `gender` | `"male"` or `"female"`. Male when left out |
| `color` | One of the species' colours. Left out, the server rolls one on the game's weights and keeps it |
| `name` | A name of its own, at most 64 UTF-8 bytes. Empty for the species' name |
| `x`, `y`, `z`, `yaw` | Where it stands and which way it faces, in the room's coordinates. Left out, or off its vivarium's island, it starts at a spot on the island |
| `happiness` | 0 to 100. 0 when left out |
| `fed`, `petted` | Its needs met this cycle |
| `byproduct` | 0 to 1. At 1 it is ready to collect |
| `pregnancy` | A mother's pregnancy, below |
| `updatedAt` | When its byproduct was last brought up to date, in epoch seconds |

A mother's `pregnancy`:

| Field | Holds |
| --- | --- |
| `stage` | `"gestation"` or `"incubation"` |
| `startedAt` | When the stage began, in epoch seconds |
| `pen` | The breeding pen's `uid` among the room's objects |
| `father` | The father's `id` in the room |
| `child` | The young's `gender` and `color`, rolled at the breed |

`load` throws, and loads nothing, for a beast entry it cannot read: a missing or unknown species, a vivarium other than the four, a colour the species does not have, a gender other than `"male"` or `"female"`, a name over 64 UTF-8 bytes, happiness outside 0 to 100, a byproduct outside 0 to 1, an `id` that is not a whole number up to 4294967295 or that appears twice, or more than 12 beasts or 4 species in one vivarium. A pregnancy has to be on a female adult of a species that breeds, name its `pen`, be in `"incubation"` only for an egg-layer, and give the young a colour it can have.

## Where to go next

- [Rooms](/guides/room-of-requirement/rooms/) for loading, decorating and saving rooms.
- [Wings, vivariums and recipes](/guides/room-of-requirement/unlocks/) for opening the vivarium biomes and giving players the feeder and pen recipes.
- [Catching beasts](/guides/npcs-and-creatures/catching-beasts/) for the bag that releases and takes go through.
- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for care, happiness and the other `Beast` calls.
