---
title: Encounter policy
description: Decide whether Overland's enemy camps and roaming encounters are switched off, spawned by each player's game, or run by the server for everyone.
sidebar:
  order: 450
---

Overland is full of enemy camps, roaming encounters and wild creatures. In single player the game spawns them as the player explores. In multiplayer, the encounter policy decides who spawns them. Enemies that belong to a mission always come from each player's own game, whatever the policy.

## Choosing a policy

`World.setEncounterPolicy(policy)` on the server sets the policy for every player, and `World.encounterPolicy` reads it back:

| Policy | Camps and roaming encounters | Wild creatures |
| --- | --- | --- |
| `"suppressed"`, the default | None | None |
| `"native"` | Each player's game spawns its own: players see different enemies in the same place | Each player's game spawns its own |
| `"server"` | The server spawns [camps](/guides/encounters/camps/) and [world events](/guides/encounters/world-events/) as NPCs that every player meets | None |

```js
// server/main.js
World.setEncounterPolicy("server");
```

`setEncounterPolicy` returns `false` for any other value.

The policy belongs to the server, not to your resource: it stays when your resource stops, and any resource can change it. On a client, `World.encounterPolicy()` returns `true` while the player's game is not spawning its own encounters, under `"suppressed"` and `"server"` alike.

## Running encounters on the server

Under `"server"`, the camps and roaming encounters are the game's own, at the game's places, with the game's enemies. They spawn as ordinary hostile [NPCs](/guides/npcs-and-creatures/npcs/), so every NPC call works on them and `npcDied` fires when one dies.

Some of what the game does in single player is not reproduced. Camp patrols, campfire activities and reinforcement waves are missing, and enemies wait where they spawned until they notice someone. An enemy's level is whatever the player's game running it gives it.

Leaving `"server"` removes every camp and world-event enemy within half a second. It also forgets which enemies each camp rolled, which of them died and every world event's cooldown, so switching back starts everything afresh.

## Encounters and virtual worlds

The game's camps and world events are in [virtual world](/guides/core-concepts/virtual-worlds/) 0, in Overland. Only players in world 0 in Overland bring them to life. Players in other worlds, in a dungeon, in the Room of Requirement or on a loading screen never trigger them. Players in the global world `4294967295` see them, but do not trigger them either.

## Where to go next

- [Camps](/guides/encounters/camps/) for the enemy camps and how they come back.
- [World events](/guides/encounters/world-events/) for the roaming encounters.
