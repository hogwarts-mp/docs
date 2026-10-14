---
title: Virtual worlds
description: Split players and entities into separate copies of the world, how a player's world combines with the map they are in, and what ignores worlds.
sidebar:
  order: 230
---

A virtual world is a number that partitions replication. A player sees the players and entities in their own world and nothing in any other, so several groups can share the same place without meeting: a duel arena, a private event or a tutorial. Players in different worlds do not hear each other on voice chat either.

Everyone starts in world 0. World `4294967295` is global: whatever is in it is seen from every world, and a player in it sees every world, which suits admins and spectators.

## Moving players

`player.setVirtualWorld(world)` moves a player and `player.virtualWorld` reads it back:

```js
// server/main.js
let nextArena = 1;

function startDuel(first, second) {
  const arena = nextArena++;
  first.setVirtualWorld(arena);
  second.setVirtualWorld(arena);
  return arena;
}

function endDuel(players) {
  for (const player of players) player.setVirtualWorld(0);
}
```

The value reads back at once and takes effect on the next server tick. A player's world goes back to 0 when they reconnect.

### Worlds and maps

The world you set is combined with the map the player is in. In Overland, the game's main map, world N is world N. Every other map, such as a dungeon, has worlds of its own: players there share a world with the others in the same map who have the same world number, and never meet anyone in another map.

During a loading screen between maps, each player is alone in a world of their own. In the Room of Requirement, each room is a world of its own, combined with the world number: see [Who sees whom](/guides/room-of-requirement/doors-and-visits/#who-sees-whom).

`player.virtualWorld` returns the number you set, not this combined world.

## Placing entities

NPCs, beasts, world objects, effects and characters start in world 0, whoever created them. Move an entity into a player's world after creating it:

```js
// server/main.js
function spawnArenaGuard(arena, x, y, z) {
  const guard = NPC.create("Goblin_Grunt", x, y, z, "hostile");
  guard?.setVirtualWorld(arena);
  return guard;
}
```

An entity's world is not combined with a map, so it lines up with a player's world only in Overland. In any other map no world number matches, and only the global world `4294967295` reaches players there. An effect attached to an entity does not take that entity's world; set it on the effect too.

An NPC's or beast's AI runs on the client of a player who can see it, so in a world with no players it stands still until someone arrives. `NPC.create`'s `preferredOwnerId` is honoured only if that player can see world 0 when the NPC spawns.

### Showing an entity to one player

`entity.setVisibleTo(player)` narrows who receives an entity to that one player, as long as they could see it anyway; it does not show an entity across worlds. `entity.setVisibleTo(null)` undoes it. The setting follows that player's connection, so after they reconnect nobody receives the entity until you set it again. Use it on NPCs and objects, not on players.

## What ignores worlds

Some things reach every player whatever their world. Filter them yourself where it matters:

- `Chat.sendToAll` and `Events.emitAllClients` send to everyone.
- `PlayerManager.getAll()` and the other managers' `getAll()` return every player or entity.
- `World.state` reaches every client.
- `player.setVisible(false)` hides a player from everyone, in every world.

```js
// server/main.js
function sendToWorld(world, text) {
  for (const player of PlayerManager.getAll()) {
    if (player.virtualWorld === world) player.sendChat(text);
  }
}
```

## Where to go next

- [Authority](/guides/core-concepts/authority/) for what the server owns and what clients only report.
- [State bags](/guides/core-concepts/state-bags/) for per-entity state, which follows the same visibility.
