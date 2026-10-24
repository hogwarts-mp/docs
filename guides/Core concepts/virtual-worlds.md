---
title: Virtual worlds
description: Split players and entities into separate copies of the world, how a world combines with the map it is in, and what ignores worlds.
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

A world is combined with the map it is in. In Overland, the game's main map, world N is world N. Every other map, such as a dungeon, has worlds of its own: players there share a world with the others in the same map who have the same world number, and never meet anyone in another map. So world N of a dungeon is one copy of it, and several groups can each have their own. The global world is global in every map.

A map is named by the `areaId` that [`player.location()`](/guides/players/join-and-spawn/#putting-players-in-place) reports there, such as `"Overland"` or `"DeathlyHallows_Dungeon"`. A player keeps their world number when they change maps, and `player.virtualWorld` returns that number, not the combined world.

During a loading screen between maps, each player is alone in a world of their own. In the Room of Requirement, each room is a world of its own, combined with the world number: see [Who sees whom](/guides/room-of-requirement/doors-and-visits/#who-sees-whom).

## Placing entities

NPCs, beasts, world objects, effects and characters start in world 0 of Overland, whoever created them. `entity.setVirtualWorld(world, map)` moves one into a world of a map, where it meets the players in that world of that map. `map` is an `areaId`, with `"Overland"` or `""` for Overland; leave it out to keep the entity in the map it is in. `entity.virtualWorld` reads back the world number.

This sends a party into its own copy of a dungeon, with guards waiting:

```js
// server/main.js
const DUNGEON = "DeathlyHallows_Dungeon";
let nextRun = 1;

function startRun(party, guardSpots) {
  const run = nextRun++;
  for (const spot of guardSpots) {
    const guard = NPC.create("Goblin_Grunt", spot.x, spot.y, spot.z, "hostile");
    guard?.setVirtualWorld(run, DUNGEON);
  }
  for (const player of party) {
    player.setVirtualWorld(run);
    player.fastTravel("FT_DeathHallows");
  }
  return run;
}
```

Positions are in the map's own coordinates. Changing an entity's map does not move it: it stands at the same coordinates in the new map. An effect attached to an entity does not take that entity's world or map; set them on the effect too.

`NPC.create` and `Beast.create` with a `preferredOwnerId` start the NPC or beast in that player's world and map. An NPC's or beast's AI runs on the client of a player who can see it, so in a world with no players it stands still until someone arrives.

### Showing an entity to one player

`entity.setVisibleTo(player)` narrows who receives an entity to that one player, as long as they could see it anyway; it does not show an entity across worlds. `entity.setVisibleTo(null)` undoes it. The setting follows that player's connection, so after they reconnect nobody receives the entity until you set it again. Use it on NPCs and objects, not on players.

## Loot, zones and sounds

These calls take a `virtualWorld` and a `map` in their options, the way `setVirtualWorld` takes them:

| Call | With `virtualWorld` and `map` |
| --- | --- |
| [`Lootables.place(kind, x, y, z, yaw, options)`](/guides/world/loot/#placing-a-lootable) | Places the lootable in that world of that map |
| `Brewing.place(uid, registryId, x, y, z, yaw, options)` | Places the cauldron there |
| `Herbology.place(plotSize, x, y, z, options)` | Places the herb plot there |
| [`Zone.create(key, shape, options)`](/guides/encounters/zones/#creating-a-zone) | Watches that world of that map |
| [`Audio.playSoundAt(event, x, y, z, options)`](/guides/camera-and-sound/audio/#playing-sounds-from-the-server) | Plays only to the players in that world of that map |

Without them, the first four use world 0 of Overland, and a sound reaches every player in range whatever their world. `Audio.playSoundOnPlayer` always keeps to that player's world and map.

```js
// server/main.js
function stockVault(run, vault) {
  const where = { virtualWorld: run, map: "DeathlyHallows_Dungeon" };
  Lootables.place("chest", vault.x, vault.y, vault.z, 0, { items: [{ itemId: "Edurus", count: 3 }], ...where });
  Zone.create(`dungeon-run:${run}:vault`, { type: "sphere", center: vault, radius: 800 }, where);
}
```

A herb plot's id comes from its coordinates alone, so a spot holds one plot across every world: placing another at the same spot, in any world, replaces it.

## What ignores worlds

Some things reach every player whatever their world. Filter them yourself where it matters:

- `Chat.sendToAll` and `Events.emitAllClients` send to everyone.
- `Audio.playSoundForAll` plays to everyone, and `Audio.playSoundAt` without `virtualWorld` or `map` to everyone in range.
- `PlayerManager.getAll()` and the other managers' `getAll()` return every player or entity.
- `World.state` reaches every client.
- `player.setVisible(false)` hides a player from everyone, in every world.

```js
// server/main.js
function sendToWorld(world, map, text) {
  for (const player of PlayerManager.getAll()) {
    if (player.virtualWorld === world && player.location()?.areaId === map) player.sendChat(text);
  }
}
```

## Where to go next

- [Travel between places](/guides/players/travel/) for moving players into another map.
- [Authority](/guides/core-concepts/authority/) for what the server owns and what clients only report.
- [State bags](/guides/core-concepts/state-bags/) for per-entity state, which follows the same visibility.
