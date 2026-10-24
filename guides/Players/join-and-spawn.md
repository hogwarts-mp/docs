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
| `playerConnect` | The player has connected | Load their saved data and set their state |
| `worldReady` | Their world, character and replication are ready | |
| `loadingFinished` | Their load screen is gone | Move them to a spawn point, open your UI |
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

To choose where a player starts, teleport them once their load screen is gone. `player.teleport(x, y, z, options)` queues the move on the player's client and returns a request id, and `playerTeleportComplete` reports how it went:

```js
// server/main.js
const spawnPoint = { x: 0, y: 0, z: 0, yaw: 90 }; // your spawn point, in world centimetres
const spawning = new Map();

Events.on("loadingFinished", (player) => {
  const requestId = player.teleport(spawnPoint.x, spawnPoint.y, spawnPoint.z, { yaw: spawnPoint.yaw, snapToGround: true });
  if (requestId > 0) spawning.set(requestId, player.id);
});

Events.on("playerTeleportComplete", (player, requestId, status) => {
  if (!spawning.delete(requestId)) return;
  if (status !== 0) console.warn(`spawn teleport for ${player.nickname} ended with status ${status}`);
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

Whether players respawn on their own is `mod.autoRespawn` in [`server.json`](/guides/hosting-a-server/configuration/#respawning), on by default. To decide for one death, call `player.setAutoRespawn(false)` inside the `playerDied` handler and respawn the player yourself with `player.respawn()`. It reloads Overland for them and stands them at the position you give, or at the game's default start without one:

```js
// server/main.js
Events.on("playerDied", (player) => {
  player.setAutoRespawn(false);
  setTimeout(() => {
    if (player.connected && player.isDead()) player.respawn({ position: spawnPoint, yaw: spawnPoint.yaw });
  }, 10000);
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
