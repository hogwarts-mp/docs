---
title: Running a match
description: Build a Quidditch match from server objects, with race rings for hoops, a physics quaffle players carry and throw, bludgers the server moves, and the game's snitch flown for everyone.
sidebar:
  order: 850
---

There is no Quidditch game mode built in. A match is server code built from [world objects](/guides/world/objects-and-effects/): race rings for hoops, a [physics object](/guides/world/physics-objects/) for the quaffle, objects the server moves for the bludgers, and the game's own snitch. The server keeps the score and decides goals, catches and hits from where everything is. Players fly with their own [brooms](/guides/mounts-and-races/brooms-and-mounts/).

Run the match on a timer on the server, around 20 times a second, and keep every decision there.

## The pitch

Hoops are the game's race ring, placed as a Blueprint:

```js
// server/main.js
const RING = "/Game/Gameplay/BroomRaces/Blueprints/BP_RaceRing.BP_RaceRing_C";

function placeHoops(hoops) {
  return hoops.map((hoop, i) => WorldObject.create(`match:hoop:${i}`, RING, { x: hoop.x, y: hoop.y, z: hoop.z, yaw: hoop.yaw }));
}
```

A ring stands on hidden pillars about 11 m below its opening, so keep hoops at least 13 m above the ground. The ring itself notices only players, never the ball, so goals are yours to decide.

House banners and other dressing are plain world objects with `collision: false`.

## The quaffle

The quaffle is a physics object, created from the game's toy quaffle:

```js
// server/main.js
const QUAFFLE = "/Game/Gameplay/Nurturing/Creatures/Meshes/Toys/SM_Sanc_BeastToy_QuidditchQuaffle.SM_Sanc_BeastToy_QuidditchQuaffle";
const quaffle = WorldObject.create("match:quaffle", QUAFFLE, { x: 0, y: 0, z: 2000, physics: true, massKg: 2 });
```

- **Picking it up:** a player's client asks with an event; the server checks they are close enough and allowed, then calls `quaffle.attachTo(player, "WandSocket")`.
- **Throwing:** the client sends only where the player is aiming, from `LocalPlayer.getControlRotation()`. The server works out the speed itself, within limits, and calls `quaffle.detach()` and `quaffle.setVelocity(...)`.
- **Dropping it** when the carrier is hit or leaves: `quaffle.detach()`.
- **Resetting** after a goal: `detach()`, set `position`, then `setVelocity(0, 0, 0)`.

[Carrying it](/guides/world/physics-objects/#carrying-it) shows the pick-up and throw handlers.

## Goals

A loose quaffle's position comes from the player simulating it, and it can move several metres between two checks. Test whether the line from its last position to its new one passes through a hoop's opening, rather than whether a single position is inside it:

```js
// server/main.js
function crossedHoop(hoop, from, to, radius) {
  const yaw = (hoop.yaw * Math.PI) / 180;
  const nx = Math.cos(yaw);
  const ny = Math.sin(yaw);
  const side = (p) => (p.x - hoop.x) * nx + (p.y - hoop.y) * ny;
  const a = side(from);
  const b = side(to);
  if (a === b || Math.sign(a) === Math.sign(b)) return false;
  const t = a / (a - b);
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const z = from.z + (to.z - from.z) * t;
  return Math.hypot(x - hoop.x, y - hoop.y, z - hoop.z) <= radius;
}
```

While a player carries the quaffle, use their position instead, and decide whether flying it through a hoop counts.

## Bludgers

Bludgers are world objects the server moves itself, not physics objects: each tick, work out where each one heads and set its `position`, and every player sees it glide there. A hit is the server finding a bludger close enough to a player.

```js
// server/main.js
const BLUDGER = "/Game/RiggedObjects/Props/Quidditch/Bludger/SK_Quid_Bludger.SK_Quid_Bludger";
const bludger = WorldObject.create("match:bludger:0", BLUDGER, { x: 0, y: 0, z: 2500, scale: 4, collision: false });
```

## The snitch

The snitch is the game's own loose snitch, created as a simulated Blueprint so that one player's game flies it and everyone else sees the same flight:

```js
// server/main.js
const SNITCH = "/Game/Levels/WorldEvents/Blueprints/LooseSnitch/BP_Loose_Snitch.BP_Loose_Snitch_C";
const snitch = WorldObject.create("match:snitch", SNITCH, { x: 0, y: 0, z: 3000, scale: 4, simulated: true });
```

It flies itself, in arcs, inside a box. Steer it a few times a second by writing where the box is, how big it is and how fast the snitch flies to its [state](/guides/core-concepts/state-bags/):

```js
// server/main.js
function steerSnitch(target) {
  if (!snitch) return;
  snitch.state.set("snitch.x", target.x);
  snitch.state.set("snitch.y", target.y);
  snitch.state.set("snitch.z", target.z);
  snitch.state.set("snitch.roam", 3000); // the box's size, in centimetres
  snitch.state.set("snitch.speed", 3); // how fast it flies, 3 by default
}
```

A catch is the server finding a seeker within a few metres of `snitch.position` for long enough, say two seconds. That position comes from the player flying the snitch.

## Trust

The quaffle's and snitch's positions are reported by whichever player's game simulates them, and the server takes their word. Keep every decision on the server, check distances there, and treat what clients send, such as aim, as requests.

## Cleaning up

The objects belong to the resource that created them and are destroyed when it stops. Let go of the quaffle when its carrier disconnects, or nobody simulates it.

## Where to go next

- [Physics objects](/guides/world/physics-objects/) for simulation, pushes and carrying.
- [Brooms and mounts](/guides/mounts-and-races/brooms-and-mounts/) for getting the players in the air.
