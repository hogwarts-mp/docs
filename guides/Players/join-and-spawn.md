---
title: Join and spawn
description: Admit or turn away joining players, the events a join raises, putting players where you want them, deaths and respawns, and leaving.
sidebar:
  order: 300
---

A player's visit raises a fixed series of events on the server. This page follows it from the request to join to the moment they leave.

## The visit, step by step

| Event | When it fires | Use it to |
| --- | --- | --- |
| `playerConnecting` | A player asks to join, before they hold a slot or receive anything | Turn players away: bans, whitelists, queues, join tickets |
| `playerConnect` | The player has connected | Load their saved data, set their state and their spawn point |
| `worldReady` | Their world, character and replication are ready | |
| `loadingFinished` | Their load screen is gone | Restore their look and inventory, open your UI |
| `playerDisconnect` | They are leaving; their handle still works inside the handler | Save their data and clean up |

The server also announces every join and departure in chat by itself.

## Admitting players

`playerConnecting` receives a pending connection rather than a player. The request waits until every handler has returned and every promise a handler returned has settled, and then the player is let in if a slot is free. With no handler at all, everyone is let in at once.

- `connection.reject(reason)` turns the player away on the next server tick. They read `reason` as you wrote it, up to 512 bytes. A handler that throws or rejects turns the player away too.
- `connection.update(message)` shows the waiting player one status line, up to 256 bytes, and restarts the admission timeout. Without updates, a request still undecided after 30 seconds is turned away.
- `connection.isPending()` is `false` once the request was decided or the player gave up, so a queue can drop them.

```js
// server/main.js
Events.on("playerConnecting", async (connection) => {
  connection.update("Checking the whitelist");
  const account = await findWhitelistedAccount(connection.ticket);
  if (!account) connection.reject("This server is whitelisted. Apply on our Discord to play.");
});
```

`connection.nickname` and the platform identifiers are what the client announced, so check a ticket instead when it matters who someone is. See [Knowing who a player is](/guides/core-concepts/authority/#knowing-who-a-player-is).

## Putting players in place

A spawn point decides where a player's game stands them when it loads them into the world. Without one, a joining player starts where the game does, in their house dormitory. Once they are in the world, a teleport moves them.

### Spawn points

`World.setSpawn(spawn)` sets the spawn point for every player, and `player.setSpawn(spawn)` sets one for a single player. A spawn point is a `position` in Overland, in world centimetres, and a `yaw` to face, in degrees, 0 when left out:

```js
// server/main.js
World.setSpawn({ position: { x: 366784, y: -461527, z: -82610 }, yaw: -130 });

const lastPositions = new Map(); // hardware id -> where the player stood when they last left

Events.on("playerConnecting", async (connection) => {
  const saved = await loadLastPosition(connection.hardwareId);
  if (saved) lastPositions.set(connection.hardwareId, saved);
});

Events.on("playerConnect", (player) => {
  const saved = lastPositions.get(player.hardwareId);
  lastPositions.delete(player.hardwareId);
  if (saved) player.setSpawn({ position: { x: saved.x, y: saved.y, z: saved.z }, yaw: saved.yaw });
});
```

A spawn point applies to two loads:

- The load that brings a joining player into the world. They arrive straight at the spawn point and never pass through the dormitory.
- A respawn after a death that names no position. See [Deaths and respawns](#deaths-and-respawns).

The player's own spawn point comes first, then the world's, then the game's own start. `player.getSpawn()` and `World.spawn` read them back, or `null` when unset. `player.setSpawn(null)` hands the player back to the world's spawn point, and `World.setSpawn(null)` hands everyone back to the game's start. A malformed spawn point makes `World.setSpawn` return `false` and `player.setSpawn` throw.

For the joining load, call `player.setSpawn` inside a `playerConnect` handler, before it awaits anything. Once the load has begun, a new spawn point only applies to later respawns. That is why the sample fetches the saved position in `playerConnecting`, whose handlers the join waits for. A player's spawn point lasts for their connection, so set it again on each visit. A `World.setSpawn` change applies from the next join or respawn and moves nobody who is already in the world.

Both loads bring the player into Overland, so a spawn point has no map of its own. To start a player in a dungeon or a mod's map, send them there with [`travelToMap`](/guides/players/travel/#loading-another-map) once they have loaded.

### Teleporting

`player.teleport(x, y, z, options)` moves a player within the map they are in. It queues the move on the player's client and returns a request id, and `playerTeleportComplete` reports how it went. This `/spawn` command takes a player back to their spawn point:

```js
// server/main.js
const spawning = new Map();

Events.on("chatCommand", (player, message, command) => {
  if (command.toLowerCase() !== "spawn") return;
  const spawn = player.getSpawn() ?? World.spawn;
  if (!spawn || player.location()?.areaId !== "Overland") {
    player.sendChat("There is no spawn point to go back to from here.");
    return;
  }
  const { x, y, z } = spawn.position;
  const requestId = player.teleport(x, y, z, { yaw: spawn.yaw, snapToGround: true });
  if (requestId > 0) spawning.set(requestId, player.id);
});

Events.on("playerTeleportComplete", (player, requestId, status) => {
  if (!spawning.delete(requestId)) return;
  if (status !== 0) player.sendChat(`Could not take you to your spawn point (status ${status}).`);
});
```

| Option | Meaning |
| --- | --- |
| `yaw` | The heading to face, in degrees. Omitted, the player keeps theirs. |
| `snapToGround` | Let the game drop the player onto the ground below the point. |
| `groundSnapDistance` | How far down to search for ground, in centimetres: 2000 by default, at most 100000. |

The completion's `status` is 0 for success, 1 when a newer teleport replaced this one, 2 when the player's game could not teleport yet, 3 when they changed worlds first, 4 when the teleport failed and 5 when it timed out.

A teleport stays within the map the player is in. To move them to another map, a fast-travel point or a place the game builds from several maps, see [Travel between places](/guides/players/travel/).

`player.location()` returns the map and region the player is in together with their position, or `null` until they reach a playable world and while they change worlds. `playerLocationChanged` fires whenever that changes. Both are reported by the player's client.

## Deaths and respawns

When a player dies, `playerDied` fires. By default they respawn on their own a few seconds later, and `playerDownedEnd` fires once they are back up. `playerDowned` fires when a player is knocked into the near-death kneeling state, and `playerDownedEnd` ends that too. `player.isDead()` is `true` from `playerDied` until `playerDownedEnd`.

Whether players respawn on their own is `mod.autoRespawn` in [`server.json`](/guides/hosting-a-server/configuration/#respawning), on by default. A respawn reloads Overland for the player and stands them at their [spawn point](#spawn-points), or at the game's default start without one.

To decide for one death, call `player.setAutoRespawn(false)` inside the `playerDied` handler. The player stays where they fell, still watching the world, until you bring them back one of two ways:

| Call | What it does |
| --- | --- |
| `player.respawn(options)` | Reloads Overland and stands them at `options.position`, facing `options.yaw`. Without a position, they stand at their spawn point. |
| `player.revive(options)` | Stands them up where they lie, with no reload: the game's own get-up plays and the world around them stays as it is. `options.health` is the health they get up with, up to their maximum; left out or `"max"`, they get up at full health. |

Both return `false` for a player who is not dead, and `playerDownedEnd` fires once they are up. A kneeling player is not dead, so `revive` does not apply to them; a kneel ends on its own, as [Defeat](/guides/pvp/hits-and-defeat/#defeat) explains.

`revive` also returns `false` once a respawn or another revive is on its way. With auto-respawn on, the server orders the respawn as soon as the `playerDied` handlers have run, so revive a player inside the handler, or hold the death with `setAutoRespawn(false)` and revive them later. Here a friend has 30 seconds to revive a fallen player before they respawn:

```js
// server/main.js
Events.on("playerDied", (player) => {
  player.setAutoRespawn(false);
  player.sendChat("You are down. A friend has 30 seconds to /revive you.");
  setTimeout(() => {
    if (player.connected && player.isDead()) player.respawn();
  }, 30000);
});

Events.on("chatCommand", (player, message, command, args) => {
  if (command !== "revive") return;
  const fallen = PlayerManager.getAll().find((other) => other.nickname === args[0]);
  if (!fallen?.revive({ health: fallen.maxHealth / 2 })) player.sendChat(`${args[0] ?? "Nobody"} cannot be revived.`);
});
```

`player.setAutoRespawn(null)` goes back to the server's setting. `playerDied`, `playerDowned` and `playerDownedEnd` are reported by the player's client, so treat them as claims; see [Authority](/guides/core-concepts/authority/).

## Leaving

`playerDisconnect` fires while the player is leaving, and their handle still works inside the handler. It is the last event for that player: a dropped connection raises nothing else, so save and clean up there.

```js
// server/main.js
Events.on("playerDisconnect", (player) => {
  spawning.forEach((playerId, requestId) => {
    if (playerId === player.id) spawning.delete(requestId);
  });
  savePlayer(player);
});
```

Anything you kept only in the player's [state bag](/guides/core-concepts/state-bags/) or inventory is gone once they have left.

## Where to go next

- [Chat and commands](/guides/players/chat-and-commands/) for talking to players and handling slash commands.
- [Inventory](/guides/players/inventory/) for giving items and saving inventories between visits.
