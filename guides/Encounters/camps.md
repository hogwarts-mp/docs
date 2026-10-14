---
title: Camps
description: How the server spawns Overland's enemy camps when players come near, brings their dead back, and tells you when one is cleared.
sidebar:
  order: 455
---

Under the [`"server"` encounter policy](/guides/encounters/encounter-policy/), the server runs the game's enemy camps: more than 300 of them across Overland. The `Camps` global reads them and tunes how they come back.

## How a camp runs

A camp spawns its enemies when a player in world 0 comes within its trigger radius. The nearest player's game runs them. The first time, the camp rolls its roster, as the game does; after that it keeps the same roster.

Some camps are only active at certain hours of the server's [clock](/guides/world/time-and-weather/): ten of them only at night, from 21:00 to 05:00. A camp only starts during its hours, and one already running finishes normally.

A camp despawns 10 seconds after nobody is inside its cull radius and nobody is within 30 m of one of its enemies. Its dead stay dead when it despawns, so a camp left half cleared comes back half cleared. They return `Camps.respawnSeconds` after the last of them died, once nobody is near: 900 seconds by default, in real time, whatever the clock does.

`Camps.setRespawnSeconds(seconds)` sets that, from 0 to a week. With 0, the dead return as soon as everyone has left.

## Reading camps

`Camps.getAll()` lists every camp, and `Camps.get(id)` returns one or `null`:

| Field | Meaning |
| --- | --- |
| `id` | Its id, such as `"<level>:<actor>"` |
| `source` | `"catalog"` for the game's own camps, `"harvested"` for camps learned from modded levels |
| `x`, `y`, `z` | Where it is |
| `triggerRadius`, `cullRadius` | How near a player must come for it to spawn, and how far they must go for it to despawn, in centimetres |
| `activeFrom`, `activeTo` | The hours it may start, wrapping past midnight; 0 to 24 is all day |
| `active` | Whether its enemies are out |
| `rolled`, `dead` | How many enemies its roster has, 0 until a player first comes near, and how many of them are dead |
| `npcs` | Its live enemies, as [NPCs](/guides/npcs-and-creatures/npcs/) |

`Camps.revive(id)` despawns a camp and forgets its roster, so the next player to arrive meets a fresh roll.

## Camp events

`campActivated` fires with the camp's id every time its enemies spawn, after each despawn too. `campCleared` fires when every enemy of an active camp is dead. Nothing fires when a camp despawns because everyone left.

```js
// server/main.js
Events.on("campCleared", (campId) => {
  const camp = Camps.get(campId);
  if (!camp) return;
  const minutes = Math.round(Camps.respawnSeconds / 60);
  for (const player of PlayerManager.getAll()) {
    const pos = player.position;
    if (player.virtualWorld === 0 && Math.hypot(pos.x - camp.x, pos.y - camp.y) <= camp.cullRadius) {
      player.sendChat(`Camp cleared. It returns ${minutes} minutes after everyone leaves.`);
    }
  }
});
```

An enemy counts as dead once its NPC is gone, so destroying one from a script counts towards clearing its camp.

## What camps pay

Camp enemies pay out like any NPC. `Camps.setRewardPolicy(policy)` sets what every camp's enemies pay, and `Camps.setRewardPolicy(policy, campId)` what one camp's do. A camp's own policy wins, then the one for every camp, then `NPC.setDefaultRewardPolicy`. `Camps.getRewardPolicy(campId)` reads back what applies.

```js
// server/main.js
Camps.setRewardPolicy({ recipients: "damagers", experience: 50 });
```

## Camps in modded levels

A camp a player's game places beyond the game's own, in a modded level, is learned from that player while the policy is `"server"`. It is listed with `source: "harvested"` and kept until the server stops. Its enemies must be ones the game knows: enemies a mod adds cannot be spawned.

## Where to go next

- [World events](/guides/encounters/world-events/) for the roaming encounters.
- [NPCs](/guides/npcs-and-creatures/npcs/) for what you can do with a camp's enemies.
