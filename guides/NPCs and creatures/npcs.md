---
title: NPCs
description: Spawn the game's enemies as replicated NPCs, control their health, targets, size and behaviour, and read what they are doing.
sidebar:
  order: 400
---

`NPC.create` spawns one of the game's enemies as a replicated NPC that every nearby player sees and fights. The server decides that it exists and holds what you set on it; its AI runs on one nearby player's client. [Fighting NPCs](/guides/pve/fighting-npcs/) covers what happens when players fight it, and [Rewards and loot](/guides/pve/rewards-and-loot/) what its death pays.

## Spawning

```js
// server/main.js
const grunt = NPC.create("Goblin_Grunt", x, y, z, "hostile");
if (grunt) {
  grunt.setScale(1.5);
  grunt.setMaxHealth(2000);
}
```

`NPC.create(enemyId, x, y, z, disposition, preferredOwnerId)` takes:

- `enemyId`: one of the game's enemy ids, one of the Mod's short names such as `Goblin_Grunt`, or an enemy's class path. The server does not check it for you: a misspelled id returns an NPC that never appears.
- A position in world centimetres.
- `disposition`: `"hostile"` (the default) or `"friendly"`.
- `preferredOwnerId`: the player whose client should run its AI. It is used only if that player can see world 0 when the NPC spawns; otherwise the server picks.

It returns the NPC, or `undefined` if it could not be created. `setScale` takes effect best right after `create`, before the NPC first reaches anyone. Pass `"visual"` as its second argument to resize only the body and keep native collision.

NPCs start in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0. The NPCs a resource creates are destroyed when that resource stops; [camp](/guides/encounters/camps/) and [world event](/guides/encounters/world-events/) enemies, and enemies an NPC summons, belong to no resource.

## Who runs the AI

An NPC's AI runs on the client of one nearby player, its owner: `npc.ownerId` names them. The server picks the nearest player within about 300 m and lets them go once they are more than 400 m away; with nobody in range the NPC is dormant and `ownerId` is 0. An NPC in a fight keeps its owner for up to 20 seconds even when someone else comes nearer.

When the owner changes, the new owner takes over the NPC where it stands: its health, its fight, a raised shield and effects that are running all carry over, and so does everything you set on the server.

Some readings come back from the owner's client, about four times a second. `npc.health` and `npc.maxHealth` are what the owner last reported, and read 0 until a client has loaded the NPC. `npc.targetPlayerId` and `npc.targetType` (0 none, 1 attack, 2 flee) report what the NPC is actually doing.

## Controlling an NPC

| Call | Does |
| --- | --- |
| `setMaxHealth(amount)` | Holds the NPC's max health, across owner hand-offs and level travel. |
| `setHealth(amount)` | Sets current health once. Does nothing while the NPC is dormant. |
| `setDisposition("hostile" \| "friendly")` | Turns the NPC against players, or out of combat. |
| `setScale(scale, mode)` | Resizes it on every client; `mode` is `"full"` (the default) or `"visual"`. |
| `forceTarget(playerId, holdSeconds)` | Makes it fight one player, the way the game's taunt does, until you pass `0` or that player dies. |
| `launch(x, y, z, options)` | Throws it through the air, as a velocity in cm/s added to its own. |
| `kill()` | Plays its death on every client, then despawns it. |
| `destroy()` | Removes it at once, with no death. |

An NPC never gets its health back by itself, and its owner finishes off any NPC at or below 12% of its max health. A `setHealth` that low kills it, and that death counts as the last hit's.

`forceTarget` does nothing on a dormant or dead NPC, and waits while the NPC's AI is paused. When the forced player is more than 55 m from the owner's player, the NPC moves to the forced player's client until the force ends. A force is not cleared when its player disconnects, so release it yourself in `playerDisconnect`. Read `targetPlayerId` to see whether it held.

`launch` returns `false` for a dormant NPC; `true` means it was sent. Pass `{ overrideXY: true }` or `{ overrideZ: true }` to replace the NPC's own speed instead of adding to it, and `{ space: "local" }` to launch along its own facing.

To walk an NPC to a spot, send it on a patrol or choose what it does when idle, see [Moving NPCs and creatures](/guides/npcs-and-creatures/movement/#npcs).

## Switching behaviour off

Five properties switch parts of an NPC's behaviour off. They are held on the server, can be set before the NPC has an owner, and carry over hand-offs:

| Setting | Effect |
| --- | --- |
| `npc.aiPaused = true` | It stops pathing and starts no new attack or dodge, and idles in place, but still reacts to hits and blocks. |
| `npc.combatEnabled = false` | It keeps chasing its target but never starts an attack, though it can still counter after a block or dodge. |
| `npc.perceptionEnabled = false` | It stops noticing players, drops its targets and idles. A forced target overrides this. |
| `npc.movementFrozen = true` | It cannot move, and `launch` does nothing. |
| `npc.animationFrozen = true` | It freezes in place on every client, pose and all. |

```js
// server/main.js
function trainingDummy(x, y, z) {
  const dummy = NPC.create("Goblin_Grunt", x, y, z, "hostile");
  if (!dummy) return undefined;
  dummy.aiPaused = true;
  dummy.combatEnabled = false;
  dummy.movementFrozen = true;
  dummy.setMaxHealth(100000);
  return dummy;
}
```

## Events

`npcDamaged` fires as players hurt an NPC, and `npcDied` when it dies, with who killed it and who fought it. [Fighting NPCs](/guides/pve/fighting-npcs/#damage-and-death) describes both.

## Where to go next

- [Fighting NPCs](/guides/pve/fighting-npcs/) for what happens when several players fight one.
- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for tame creatures and stationary townspeople.
