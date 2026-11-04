---
title: Loot
description: Place chests, moonstone deposits and foragables the server owns, decide what each player finds in them, refill them, switch off the game's own loot, or run the game's own deposits and foragables from the server.
sidebar:
  order: 530
---

Players loot the world the game's way: they open chests with F, break moonstone deposits with a spell and pick up foragables with F. The server can own any of these, so that what they hold, who can take it and when it refills are your resource's to decide. It can also take over the moonstone deposits and foragables the game spawns across Overland, so that every player shares them.

## Placing a lootable

```js
// server/main.js
const chestId = Lootables.place("chest", x, y, z, 90, {
  items: [{ itemId: "Edurus", count: 2 }, { itemId: "LacewingFlies", count: 5 }],
});
```

`Lootables.place(kind, x, y, z, yaw, options)` places a lootable for every player and returns its id, or 0 if it could not be placed. `kind` is `"chest"`, `"moonstone"` or `"foragable"`.

| Option | Meaning |
| --- | --- |
| `items` | What it holds, as `{ itemId, count }` entries with ids from the [inventory catalog](/guides/players/inventory/#reading) |
| `locked` | A locked lootable offers nothing to take |
| `mode` | `"shared"` (the default): a take empties it for everyone. `"perPlayer"`: a take empties it only for the player who took it. |
| `model` | The Blueprint to show. It defaults to a Hogwarts chest, a small moonstone deposit, or the foragable plant that gives the item. |
| `virtualWorld`, `map` | The [virtual world](/guides/core-concepts/virtual-worlds/#loot-zones-and-sounds) to place it in, and the map that world is in, by its `areaId`. World 0 of Overland by default. |

Moonstone deposits and foragables hold plain items only, and a foragable holds a single stack. A moonstone takes one of the `BP_Moonstone_S`, `_M` or `_L` Blueprints, and a foragable one of the game's five foragable Blueprints. An empty or locked moonstone shows as mined out, and an empty or locked foragable as picked.

`Lootables.get(id)` and `Lootables.list()` describe lootables, and `Lootables.remove(id)` removes one from every player.

## Taking items

When a player takes from a lootable, the server accepts the take only up to what that player sees in it, and adds the items to their [inventory](/guides/players/inventory/) by itself. Then `lootableTaken` fires with the player, the lootable's id and the items they took:

```js
// server/main.js
Events.on("lootableTaken", (player, lootableId, items) => {
  if (lootableId !== chestId) return;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  Chat.sendToAll(`${player.nickname} looted the treasure chest (${total} items).`);
  setTimeout(() => Lootables.setItems(chestId, [{ itemId: "Edurus", count: 2 }]), 10 * 60 * 1000);
});
```

The server also checks where the taker stands. A take counts only from a player the lootable is streamed to, within 25 metres of it, or 150 metres of a moonstone deposit, which a spell breaks from a distance. One reported from further away is refused and raises no event, so a modified client cannot claim loot from across the map.

Who may loot what, when a lootable refills and whether its contents survive a restart are all up to your resource. Lootables are not saved: a restart removes them, so place them again when your resource starts.

| Call | Changes, for every player without a view |
| --- | --- |
| `Lootables.setItems(id, items)` | What it holds; an empty list empties it |
| `Lootables.setLocked(id, locked)` | Whether it can be taken from |
| `Lootables.setMode(id, mode)` | `"shared"` or `"perPlayer"` |

## What one player sees

`Lootables.setView(id, player, view)` overrides what one player finds in a lootable: its `items`, whether it is `locked`, or both. Fields you leave out keep the lootable's own value, and `null` drops the view. A view lasts for the player's connection, so re-apply views when a player rejoins if they should last longer.

```js
// server/main.js
function showDailyReward(player, alreadyClaimed) {
  Lootables.setView(chestId, player, alreadyClaimed ? { items: [] } : { items: [{ itemId: "Edurus", count: 1 }] });
}
```

`Lootables.getView(id, player)` returns a player's view, or `null` when they see the lootable's own contents.

## Switching off the game's own loot

The game places its own chests, coin pouches, moonstone deposits and foragables everywhere, and each player's game spawns and empties them separately. To make your lootables the only loot, switch the game's families off with `World.suppressLoot`:

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.suppressLoot({ chests: true, pouches: true, moonstones: true, foragables: true });
});
```

Suppressed chests and coin pouches are hidden, prompt and all, and Overland's moonstone and foragable spawns are removed along with placed deposits and foragables. Room of Requirement storage and quest containers are never touched. Spawns are removed only from areas that load after the change, so call it when your resource starts. `false` switches a family back on, a family you leave out keeps its setting, and `World.lootSuppressed` reads the current settings.

For moonstones and foragables, `true` and `false` are the `"suppressed"` and `"native"` [loot policies](#the-games-own-deposits-and-foragables), so either one also stops the server's loot spots of that family.

## The game's own deposits and foragables

Each player's game spawns its own moonstone deposits and foragables across Overland, so every player has their own copy of each, and a deposit one player mines is still there for the next. `World.setLootPolicy(policy)` decides who spawns them, for each family:

| Policy | Moonstone deposits or foragables |
| --- | --- |
| `"native"` (the default) | Each player's game spawns its own, as in the single-player game |
| `"suppressed"` | Nobody spawns them, as with `World.suppressLoot` |
| `"server"` | The server runs the game's own spots as lootables every player shares |

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.setLootPolicy({ moonstones: "server", foragables: "server" });
});
```

A family you leave out keeps its policy, and `World.lootPolicy` reads both. Any other value returns `false` and changes neither family. As with `suppressLoot`, the game's own spawns are removed only from areas that load after the change, so set the policy when your resource starts. Under `"server"`, `World.lootSuppressed` reads `true` for that family, since its native spawns are off. Leaving `"server"` removes every spot of that family, and returning to it places them again, stocked.

### Loot spots

Under `"server"`, every place in Overland where the game spawns a moonstone deposit or a foragable, 4,005 of them, holds a lootable the server places once for everyone, in world 0 of Overland. Each is streamed to the players within 150 metres of it, and players mine and pick them the game's way. A take empties the spot and adds the items to the taker's inventory, as a lootable's do, and the spot restocks once its kind's respawn time has passed.

Loot spots are not lootables: `Lootables.list()` leaves them out, no `Lootables` call reaches them, and a take raises `lootSpotTaken(player, spotId, items)` instead of `lootableTaken`.

Only Overland's spots run. Under `"server"`, as under `"suppressed"`, the game's own deposits and foragables in dungeons are hidden too, and nothing takes their place.

`LootSpots.getAll()` lists every spot, whether its family runs or not, and `LootSpots.get(id)` returns one, or `null` for an unknown id:

| Field | Meaning |
| --- | --- |
| `id` | `"<tile>:<key>"`, the same across restarts while the game keeps the spot where it is |
| `kind` | Its Blueprint's short name, one of the kinds below |
| `family` | `"moonstones"` or `"foragables"` |
| `x`, `y`, `z`, `yaw` | Where it stands |
| `enabled` | `false` once `setEnabled` took it out |
| `stocked` | Under `"shared"`, `false` from a take until it restocks |
| `restockIn` | Seconds until it restocks, 0 when stocked |

Each kind hands out one item:

| Kind | Item | The game's yield |
| --- | --- | --- |
| `Moonstone_S`, `Moonstone_M`, `Moonstone_L` | `Moonstone` | 1, 2 and 3 |
| `AshwinderEgg_Nest` | `AshwinderEggs` | 1 |
| `Horklump` | `HorklumpJuice` | 1 |
| `LacewingFly` | `LacewingFlies` | 1 |
| `LeapingToadstool` | `LeapingToadstool_Byproduct` | 1 |
| `LeechForagable` | `LeechJuice` | 1 |

`LootSpots.getKinds()` returns each kind with its `family`, the Blueprint it spawns as (`model`), its `itemId`, its current `yield` as `[min, max]`, its `respawnSeconds` and how many `spots` it has.

### Respawns, yields and sharing

| Call | What it does |
| --- | --- |
| `LootSpots.setRespawnSeconds(seconds, kind)` | How long an emptied spot stays empty, from 0 to a week. The default, 4320, is the game's 3 in-game days at the default time scale. It does not follow `World.setTimeScale`, and a spot already waiting keeps its time. |
| `LootSpots.setYield(count, kind)` | How many of its item a spot holds when it restocks, from 1 to 1000: a whole number, or `[min, max]` rolled at each restock. A stocked spot keeps what it holds until it next restocks. |
| `LootSpots.setMode(mode)` | `"shared"`, the default: a take empties the spot for everyone. `"perPlayer"`: a take empties it only for the taker, who finds it stocked again a respawn time after their own take. A change restocks every spot, and `LootSpots.mode` reads it. |
| `LootSpots.setEnabled(id, enabled)` | Takes one spot out of the world, or puts it back stocked |
| `LootSpots.reset(id)` | Restocks one spot now, for every player |

`kind` is a kind's name, `"moonstones"` or `"foragables"`, and every kind when you leave it out. Each call returns `false` for an unknown kind or id, or a value out of range. Under `"perPlayer"`, what a player emptied comes back when they reconnect.

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.setLootPolicy({ moonstones: "server", foragables: "server" });
  LootSpots.setRespawnSeconds(15 * 60, "moonstones");
  LootSpots.setYield([2, 4], "foragables");
  for (const spot of LootSpots.getAll()) {
    if (inMarketSquare(spot.x, spot.y)) LootSpots.setEnabled(spot.id, false);
  }
});

Events.on("lootSpotTaken", (player, spotId, items) => {
  if (LootSpots.get(spotId)?.family !== "moonstones") return;
  const mined = items.reduce((sum, item) => sum + item.count, 0);
  addMinedMoonstones(player, mined);
});
```

Settings, empty spots and spots you took out last for the server's run and are not saved, so set them again when your resource starts.

## Where to go next

- [Inventory](/guides/players/inventory/) for what happens to taken items.
- [Objects and effects](/guides/world/objects-and-effects/) for decorating the places your loot sits.
