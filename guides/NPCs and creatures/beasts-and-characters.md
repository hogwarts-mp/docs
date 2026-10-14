---
title: Beasts and characters
description: Spawn tame beasts players can pet and feed, decide who may care for them, and place stationary townspeople and vendors with nameplates.
sidebar:
  order: 420
---

Besides enemies, the server can place two kinds of living thing: tame beasts, which wander and can be cared for, and characters, which stand still and never fight.

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

Like an NPC, a beast's AI runs on one nearby player's client, named by `beast.ownerId`, and a beast starts in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0.

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

## Characters

A character is a dressed, stationary human placed by the server: a vendor, a townsperson or a quest giver. It has no AI, no owner and no health. `Character.create(key, characterId, options)` creates one under a key of your choosing, and creating again with the same key replaces it:

```js
// server/main.js
Character.create("wand-shop", "GerboldOllivander", {
  x, y, z,
  yaw: 90,
  label: "Ollivander",
  promptText: "[F] Browse wands",
});
```

`characterId` must be one of the game's human characters that the Mod allows, such as `GerboldOllivander`; `Character.isAllowed(characterId)` tests one, and `Character.create` throws for any other. `Character.destroy(key)` removes a character by its key.

| Option | Meaning |
| --- | --- |
| `x`, `y`, `z`, `yaw` | Where it stands and which way it faces |
| `scale` | Its size; 1 is native |
| `label` | A nameplate over its head, seen from up to 25 m |
| `promptText` | A second line, seen only within `promptRange`, usually inviting players to interact |
| `promptHeight` | Where the prompt floats, in centimetres above the character's centre: 100 by default |
| `promptRange` | How close a player must be to see the prompt, in centimetres: 250 by default |

The prompt is only text. Handling the interaction it invites, such as opening a shop when a nearby player presses a key, is up to your resource.

## Where to go next

- [NPCs](/guides/npcs-and-creatures/npcs/) for enemies, their AI and what their deaths pay.
- [Authority](/guides/core-concepts/authority/) for which client runs a creature's AI and what that means.
