---
title: NPCs
description: Spawn the game's enemies as replicated NPCs, control their health, targets and size, and react when they are hurt or die.
sidebar:
  order: 400
---

`NPC.create` spawns one of the game's enemies as a replicated NPC that every nearby player sees and fights. The server decides that it exists and holds what you set on it; its AI runs on one nearby player's client.

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

- `enemyId`: one of the game's enemy ids, such as `Goblin_Grunt`, or an enemy's class path. The server does not check it for you, so check its spelling.
- A position in world centimetres.
- `disposition`: `"hostile"` (the default) or `"friendly"`.
- `preferredOwnerId`: the player whose client should run its AI. It is used only if that player can see world 0 when the NPC spawns; otherwise the server picks.

It returns the NPC, or `undefined` if it could not be created. `setScale` takes effect best right after `create`, before the NPC first reaches anyone. Pass `"visual"` as its second argument to resize only the body and keep native collision.

NPCs start in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0, and the NPCs a resource creates are destroyed when that resource stops.

## Who runs the AI

An NPC's AI runs on the client of one nearby player, its owner: `npc.ownerId` names them, and is 0 while the NPC is dormant because no player can see it. The server hands the NPC to another player as people come and go, and what you set on the server carries over.

Some readings come back from the owner's client. `npc.health` and `npc.maxHealth` are what the owner last reported, and read 0 until a client has embodied the NPC. `npc.targetPlayerId` and `npc.targetType` (0 none, 1 attack, 2 flee) report what the NPC is actually doing.

## Controlling an NPC

| Call | Does |
| --- | --- |
| `setMaxHealth(amount)` | Holds the NPC's max health, across owner hand-offs and level travel. 0 or less restores its own. |
| `setHealth(amount)` | Sets current health once. Does nothing while the NPC is dormant. |
| `setDisposition("hostile" \| "friendly")` | Turns the NPC against players, or out of combat. |
| `setScale(scale, mode)` | Resizes it on every client; `mode` is `"full"` (the default) or `"visual"`. |
| `forceTarget(playerId, holdSeconds)` | Makes it target one player for `holdSeconds`: 3 by default, at most 60. `0` releases it. |
| `kill()` | Plays its death on every client, then despawns it. |
| `destroy()` | Removes it at once, with no death. |

```js
// server/main.js
function startBossFight(boss, challenger) {
  boss.setMaxHealth(5000);
  boss.forceTarget(challenger.id, 30);
}
```

The owner's client applies the force, so read `targetPlayerId` back to see whether it held.

## Damage and death events

- `npcDamaged` gives the NPC's id, the attacking player's id and the amount, clamped and rate-capped by the server. The attacker's client reports it, so treat it as a claim.
- `npcDied` gives the NPC's id and its enemy id.

To credit the players who fought an NPC, add up its damage as it arrives and settle when it dies:

```js
// server/main.js
const damageByNpc = new Map(); // npc id -> Map(player id -> damage)

Events.on("npcDamaged", (npcId, attackerId, amount) => {
  const dealt = damageByNpc.get(npcId) ?? new Map();
  dealt.set(attackerId, (dealt.get(attackerId) ?? 0) + amount);
  damageByNpc.set(npcId, dealt);
});

Events.on("npcDied", (npcId, enemyId) => {
  const dealt = damageByNpc.get(npcId);
  damageByNpc.delete(npcId);
  if (!dealt) return;
  for (const player of PlayerManager.getAll()) {
    if (dealt.has(player.id)) player.sendChat(`You helped defeat ${enemyId}.`);
  }
});
```

The player ids are network ids, and a player may have left by the time you read one, so look them up among the online players rather than constructing a `Player` from the id.

## Where to go next

- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for tame creatures and stationary townspeople.
- [Authority](/guides/core-concepts/authority/) for which client runs an NPC's AI and what that means.
