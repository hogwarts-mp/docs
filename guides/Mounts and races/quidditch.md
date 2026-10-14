---
title: Quidditch
description: Spawn a ball, hoops, bludgers, the snitch and house banners on players' clients, and run the match itself on the server.
sidebar:
  order: 82
---

The `Quidditch` global spawns the pieces of a match on a client: a ball, hoops, bludgers, the game's snitch and house banners. It is a box of props, not a game. Nothing in it notices a goal, a catch or a hit, and each client spawns its own copy, so the server runs the match: it decides where everything is, tells clients, and works out goals and catches from positions.

## The pieces

| Piece | Spawn | Then |
| --- | --- | --- |
| Ball | `spawnBall(meshPath, x, y, z, massKg, probeRadius)` returns a handle, or 0 | `setBallPosition`, `throwBall` (velocity in cm/s), `setBallSimulating`, `attachBall`, `detachBall`, `ballPosition`, `destroyBall` |
| Hoop | `spawnHoop(x, y, z, yaw)` | `clearHoops()` removes them all |
| Bludger | `spawnBludger(x, y, z)` returns an index, or -1 | `moveBludger(index, x, y, z)`, `setBludgerScale(scale)`, `clearBludgers()` |
| Snitch | `spawnSnitch(x, y, z, scale, trailScale)` | `steerSnitch`, `setSnitchRoam`, `setSnitchSpeed`, `snitchPosition`, `despawnSnitch` |
| Banner | `spawnBanner(mesh, x, y, z, yaw, scale)` | `clearBanners()` removes them all |

- **The ball** is a physics object built from a static mesh you name. It never pushes players about. While the server carries it, turn its physics off with `setBallSimulating(id, false)` and move it with `setBallPosition`; when it is loose, turn physics on and `throwBall` it. `attachBall(id)` puts it in the local player's hand. `setBallPosition` jumps rather than travels, so test a goal against the line between two positions, not against each point.
- **A hoop** is one of the game's race rings. Leave about 11 m of clear air under it, since it stands on hidden pillars.
- **A bludger** is a puppet: `moveBludger` sets where it heads, and it glides there over the next frames. `setBludgerScale` makes them bigger, since they are small to dodge at speed.
- **The snitch** flies itself, at random, inside a box you move with `steerSnitch(x, y, z)`. `setSnitchRoam(extent)` sets how far the box reaches, in centimetres, and `setSnitchSpeed(rate)` how fast it flies, 3 by default. Each client's snitch flies its own way, so the server keeps the true position and checks catches against where clients report theirs. Call `despawnSnitch()` before spawning another.

```js
// client/main.js
Events.on("match:setup", (pitch) => {
  Quidditch.clearAll();
  for (const hoop of pitch.hoops) Quidditch.spawnHoop(hoop.x, hoop.y, hoop.z, hoop.yaw);
  Quidditch.spawnSnitch(pitch.centre.x, pitch.centre.y, pitch.centre.z + 2000, 4);
});

Events.on("match:snitch", (target) => Quidditch.steerSnitch(target.x, target.y, target.z));
```

## Cleaning up

The pieces belong to the client, not to your resource, and survive your resource restarting. `Quidditch.clearAll()` destroys everything `Quidditch` spawned and returns how many, so call it before setting up a match and as your resource stops:

```js
// client/main.js
Events.on("resourceStop", (resourceName) => {
  if (resourceName === "quidditch-match") Quidditch.clearAll();
});
```

Players are not put on brooms by any of this: [Brooms and mounts](/guides/mounts-and-races/brooms-and-mounts/#riding-a-broom) covers giving them one and getting them in the air.

## Where to go next

- [Brooms and mounts](/guides/mounts-and-races/brooms-and-mounts/) for the players' side of the match.
- [Map markers](/guides/user-interface/map-markers/) for showing players where the pitch is.
