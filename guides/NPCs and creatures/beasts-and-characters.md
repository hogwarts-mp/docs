---
title: Beasts and characters
description: Spawn tame beasts players can pet, feed and catch, decide who may care for them, and place townspeople, ghosts, house-elves and other characters with nameplates, looks, clips, wands and props.
sidebar:
  order: 420
---

Besides enemies, the server can place tame beasts, which wander and can be cared for, and characters, which never fight. A character stands where you put it, walks a path you give it or follows someone, and can play the game's animation clips.

## Beasts

`Beast.create(species, options)` spawns one of the game's tame creatures:

```js
// server/main.js
const kneazle = Beast.create("Kneazle", { x, y, z, yaw: 180, name: "Mittens", gender: "female" });
kneazle.setScale(0.8);
```

The species are the game's 13 creatures you can nurture and their young, such as `Hippogriff`, `Niffler` and `NifflerOffspring`. `Beast.catalog()` lists every species with its colours, the game's spawn weight for each and whether a colour is an effect rather than a coat. Pass `color` to choose one, or leave it out to roll on the game's own weights. `Beast.create` throws for an unknown species or a colour the species does not have.

| Option | Meaning |
| --- | --- |
| `x`, `y`, `z`, `yaw` | Where it appears and which way it faces |
| `scale` | Its size; 1 is native |
| `name` | A name of its own instead of the species name |
| `gender` | `"male"` or `"female"` |
| `color` | One of the species' colours |
| `preferredOwnerId` | The player whose client should run its AI |

Like an NPC, a beast's AI runs on one nearby player's client, named by `beast.ownerId`. Every other player sees what that AI has it do, sitting, lying down and sleeping included. A beast starts in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0, or, with `preferredOwnerId`, in that player's world and map. [Moving NPCs and creatures](/guides/npcs-and-creatures/movement/#beasts) covers walking a beast, having it follow someone and what it does when idle.

### Care and happiness

Players pet a beast with the game's brush and feed it with creature feed. Each accepted act of care adds the game's usual 11 to its `happiness`, which runs from 0 to 100 and is held by the server. `beast.addHappiness(amount)` moves it yourself, positive or negative, and every client shows the gain or loss the game's way.

`beastCared` fires with the beast, the player and `"pet"` or `"feed"` before the care is applied. A handler that returns `false` synchronously refuses it:

```js
// server/main.js
const owners = new Map(); // beast id -> owning player's id

Events.on("beastCared", (beast, player, kind) => {
  const owner = owners.get(beast.id);
  if (owner !== undefined && owner !== player.id) {
    player.sendChat(`That ${beast.species} only lets its owner ${kind === "pet" ? "pet" : "feed"} it.`);
    return false;
  }
});
```

Care is refused on its own across virtual worlds, and the server rate-limits it.

Every player who can see the beast sees the care: the brush or the thrown feed, and the beast's reaction. It plays whether or not the care counts, as it does in the carer's own game; a refused care leaves the beast's happiness where it was.

### Catching

Players can catch a beast with the game's Nab-Sack once a script makes it catchable with `beast.capturable` or `beast.setCapturableFor(player, true)`. [Catching beasts](/guides/npcs-and-creatures/catching-beasts/) covers refereeing each catch, the player's bag, keeping it across reconnects and releasing beasts.

### Beasts in a vivarium

The beasts that live in a Room of Requirement's vivariums are beasts like any other, with five more properties: `vivarium` and `room` say where one lives, and `byproduct`, `pregnancy` and `needs` follow the game's own cycle of care, harvest and breeding. Petting and feeding one also meets its `needs`. Each reads `null` for a beast in the world. [Vivariums](/guides/room-of-requirement/vivariums/) covers them.

## Characters

A character is a figure placed by the server: a vendor, a townsperson, a ghost or a quest giver. It has no AI, no owner and no health. It stands where you put it until you give it a path or someone to follow, which [Moving NPCs and creatures](/guides/npcs-and-creatures/movement/#characters) covers. `Character.create(key, characterId, options)` creates one under a key of your choosing, and creating again with the same key replaces it:

```js
// server/main.js
Character.create("wand-shop", "GerboldOllivander", {
  x, y, z,
  yaw: 90,
  label: "Ollivander",
  promptText: "[F] Browse wands",
});
```

`characterId` must be one of the game's characters that the Mod allows; `Character.isAllowed(characterId)` tests one, and `Character.create` throws for any other. Characters come in two kinds of body:

- A human id, such as `GerboldOllivander`, is built on the same body as a player's and dressed as that character.
- Other ids spawn the game's own body for that character: ghosts such as `NearlyHeadlessNick`, house-elves, goblins, centaurs, the game's crowd looks such as `T3TownspersonFemale1`, the statue busts, the Sorting Hat (`SortingHat`) and the Howler (`Howler`). The Mod switches off the AI, lock-on, interaction prompt and damage the game gives that body.

Ids with no look of their own, such as portraits and talking objects, are refused. `Character.destroy(key)` removes a character by its key.

| Option | Meaning |
| --- | --- |
| `x`, `y`, `z`, `yaw` | Where it stands, as a player's position, and which way it faces |
| `scale` | Its size; 1 is native. The body keeps its feet on the floor at any size |
| `label` | A nameplate over its head, seen from up to 25 m |
| `promptText` | A second line, seen only within `promptRange`, usually inviting players to interact |
| `promptHeight` | Where the prompt floats, in centimetres above the character's centre: 100 by default |
| `promptRange` | How close a player must be to see the prompt, in centimetres: 250 by default |
| `look` | A saved look for a human id's body to wear. See [Dressing a character in a look](#dressing-a-character-in-a-look) |

The prompt is only text. Handling the interaction it invites, such as opening a shop when a nearby player presses a key, is up to your resource.

### Dressing a character in a look

`look` dresses a character with a human id in a saved look, the way a player's body wears one: its gender, face, hair, clothes, hood, body sliders and size. It takes a look from `player.getLook()`, or its JSON text, as `player.setLook` does (see [Appearance](/guides/players/appearance/#the-look)). The id then only makes the body human, so any human id will do. A look's size multiplies `scale`.

```js
// server/main.js
// A statue of the tournament's champion, in their own look, where they stand.
function raiseStatue(champion) {
  const look = champion.getLook();
  if (!look || Object.keys(look.presets).length === 0) return; // their game has sent no look yet
  const { x, y, z } = champion.position;
  Character.create("champion-statue", "GerboldOllivander", { x, y, z, look, label: `Champion ${champion.nickname}` });
}
```

`Character.create` throws for a look `player.setLook` would refuse (`INVALID_APPEARANCE`), for one with no presets or no gear, and for a look on any id that is not human: the game's own bodies are built from their own definition. `character.look` reads back the look it wears, as the server checked it, or `null` when it wears its id's own. To change a character's look, create it again under the same key.

### Clips, wands and props

The server can pose a character with one of the game's animation clips, and put a wand or a prop in its hand. Every player near it sees them, players who come into range later included.

| Call | What it does |
| --- | --- |
| `playClip(path, options)` | Plays an animation clip on the body, replacing the clip it played |
| `stopClip()` | Ends the clip, and the body goes back to its idle |
| `setWand(shown, style)` | Puts a wand in its right hand, or takes it away with `false` |
| `equipProp(path, options)` | Attaches one of the game's meshes to a socket, replacing the prop it held |
| `clearProp()` | Takes the prop away |

`character.clip`, `character.wand`, `character.wandStyle` and `character.prop` read back what you set. Not every body has a skeleton for all three, and `Character.canPlayClip(characterId)` and `Character.canHoldWand(characterId)` test an id:

| Body | Clips | Wand | Prop sockets |
| --- | --- | --- | --- |
| Human ids, ghosts, goblins, house-elves and the crowd looks | Yes | Yes | `WandSocket`, `SKT_RightHandSocket`, `SKT_LeftHandSocket`, `prop_hand_r_SKT`, `prop_hand_l_SKT` |
| Busts | No | Yes | As above |
| Centaurs | No | No | `SKT_RightHand`, `SKT_LeftHand` |
| The Sorting Hat and the Howler | No | No | None |

```js
// server/main.js
const CROUCH = "/Game/Animation/Human/Hu_Crouch_RF_Idle_anm.Hu_Crouch_RF_Idle_anm";
const APPLE = "/Game/Environment/BanditCamps/Bandit_Camp_Shared_Props/Food/SM_BCProps_Apple_A_2bite.SM_BCProps_Apple_A_2bite";

// A healer crouches by the cot with her wand out, and the grocer holds out an apple.
const healer = Character.create("healer", "T3TownspersonFemale1", { x, y, z, yaw: 90, label: "Healer" });
healer?.playClip(CROUCH);
healer?.setWand(true);

const grocer = Character.create("grocer", "T3TownspersonMale1", { x: x + 400, y, z, label: "Grocer" });
grocer?.equipProp(APPLE, { socket: "SKT_LeftHandSocket" });
```

`playClip` takes the asset path of one of the game's animation clips. The clip must be made for the human skeleton, as the game's `Hu_` clips are; on a body it does not fit, the character keeps its idle. Its options are:

| Option | Meaning |
| --- | --- |
| `loop` | Play it over and over: `true` by default |
| `hold` | With `loop: false`, keep the last frame once it ends: `true` by default. Without it, the body goes back to its idle |
| `rate` | Its speed, 0.01 to 10: 1 by default |

Every player's game plays the clip on the server's clock, so all of them show the same frame, and a player who comes into range mid-clip joins it there. A one-shot without `hold` that has ended is not replayed for them, though `character.clip` still reads it until `stopClip()`, a new path or a follow. The props and sounds the clip carries in the game play with it. A clip holds the whole body, so `moveAlong`, `moveTo` and `follow` end it. `playClip` returns `false` when the character is gone, and throws for a path that is not an asset path, a `rate` out of range or a body that cannot play clips.

`setWand(true, style)` takes the row of one of the game's wand styles, as a look's `wandStyle` names one, such as `T003_M01_H007_M02`. Without a style the character holds the plain base wand. The server checks only that a style is shaped like a row, letters, digits and underscores, not that the game has it.

`equipProp` works like [`player.equipProp`](/guides/players/appearance/#holding-props): `options.socket` picks where the mesh attaches and `options.offset` moves, turns and scales it. The default socket is `WandSocket`, where the wand goes, so take the wand away or name another socket. A socket the body lacks leaves the prop at the body's origin. `equipProp` throws for a path that is not an asset path.

## Where to go next

- [Catching beasts](/guides/npcs-and-creatures/catching-beasts/) for the Nab-Sack, the player's bag and releasing beasts.
- [Moving NPCs and creatures](/guides/npcs-and-creatures/movement/) for walking beasts and characters, and having them follow someone.
- [Appearance](/guides/players/appearance/) for the looks a character can wear and the props a player holds.
- [NPCs](/guides/npcs-and-creatures/npcs/) for enemies and their AI, and [Rewards and loot](/guides/pve/rewards-and-loot/) for what their deaths pay.
- [Authority](/guides/core-concepts/authority/) for which client runs a creature's AI and what that means.
