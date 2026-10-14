---
title: Physics objects
description: Make world objects that fall, roll and fly, push and throw them from the server, and let players carry them.
sidebar:
  order: 515
---

A physics object is a [world object](/guides/world/objects-and-effects/#world-objects) that falls, rolls and bounces. The server runs no physics itself: the game of the nearest player simulates the object and reports where it goes, and everyone else follows. The server pushes, freezes and hands out objects, and decides what happens to them.

## Creating one

Pass `physics: true` when creating a world object from a mesh:

```js
// server/main.js
const QUAFFLE = "/Game/Gameplay/Nurturing/Creatures/Meshes/Toys/SM_Sanc_BeastToy_QuidditchQuaffle.SM_Sanc_BeastToy_QuidditchQuaffle";

const ball = WorldObject.create("park:ball", QUAFFLE, { x, y, z: z + 100, physics: true, massKg: 0.5 });
```

`massKg` sets its mass; without it, the mesh's own. A Blueprint cannot be a physics object, and `create` throws for one. The mesh needs collision of its own for the object to land on anything.

Players walk through physics objects and never push them, so anything that moves one is your script.

## Who simulates it

The nearest player within 150 m, measured along the ground, in the object's virtual world, simulates it. They keep it until they are more than 250 m away or someone else is clearly nearer. `object.simulatorId` is that player's id. With nobody near, the object rests where it was last reported until someone comes.

The simulating player's game reports where the object is, and the server takes its word. Anything you decide from a physics object's position, such as a goal, trusts that player.

## Settings

| Setting | Default | Does |
| --- | --- | --- |
| `physics` | `true` | `false` stops simulating; the object stays where it is |
| `frozen` | `false` | Holds the object still in mid-air and ignores pushes, without giving up its simulator |
| `gravity` | `true` | Whether it falls |
| `mass` | The mesh's | In kilograms; 0 or less uses the mesh's own |
| `linearDamping`, `angularDamping` | The mesh's | How quickly it slows down and stops spinning |

Use `frozen` to hold an object until it should fall, rather than turning `physics` off and on:

```js
// server/main.js
const crate = WorldObject.create("dock:crate", "/Game/Environment/BanditCamps/Interactables/SM_Int_BCProps_Barrel_001_W.SM_Int_BCProps_Barrel_001_W", {
  x, y, z: z + 600,
  physics: true,
  massKg: 40,
  promptText: "[F] Cut the rope",
});
if (crate) crate.frozen = true;

Events.onClient("dock:cut", (player) => {
  if (crate) crate.frozen = false;
});
```

## Pushing it

| Call | Does |
| --- | --- |
| `object.setVelocity(x, y, z)` | Sets its velocity in cm/s. It is kept on the object, so it applies even while nobody simulates it |
| `object.applyImpulse(x, y, z, options)` | A sudden push |
| `object.applyForce(x, y, z, options)` | A push for one physics step |
| `object.setLinearVelocity`, `object.setAngularVelocity` | Set its speed or spin |
| `object.applyTorque`, `object.applyAngularImpulse` | Spin it |

All but `setVelocity` go to the player simulating the object, and return `false` when nobody does; `true` means it was sent. `options` can set `velocityChange: true` to ignore mass, `space: "local"` to push along the object's own axes, and `at` to push at a point rather than its centre.

`object.getLinearVelocity()` and `object.getAngularVelocity()` read what the simulating player last reported.

Moving an object by setting `object.position` keeps its speed, so follow it with `setVelocity(0, 0, 0)` to put it down at rest. Physics is unreliable above about 5000 cm/s, so keep throws below that.

## Carrying it

`object.attachTo(player, socket)` puts a physics object in a player's hand, at a socket such as `WandSocket`, and that player's game takes it over. `object.detach()` lets go, and `setVelocity` straight after throws it. `object.ownerId` is the carrier, or the simulating player.

```js
// server/main.js
let carrierId = null;

Events.onClient("ball:grab", (player) => {
  if (carrierId !== null || !ball) return;
  const p = player.position;
  const b = ball.position;
  if (Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) > 300) return;
  carrierId = player.id;
  ball.attachTo(player, "WandSocket");
});

Events.onClient("ball:throw", (player, aim) => {
  if (carrierId !== player.id || !ball || !aim) return;
  carrierId = null;
  const length = Math.hypot(aim.x, aim.y, aim.z) || 1;
  ball.detach();
  ball.setVelocity((aim.x / length) * 2500, (aim.y / length) * 2500, (aim.z / length) * 2500);
});

Events.on("playerDisconnect", (player) => {
  if (carrierId !== player.id || !ball) return;
  carrierId = null;
  ball.detach();
});
```

Let go of an object when its carrier disconnects: until you do, nobody simulates it.

## Noticing what happens

Physics objects raise no events of their own: nothing fires when one lands, hits something or is picked up. Check their positions on a timer, or put a [zone](/guides/encounters/zones/) that tracks `"worldObject"` where something should happen. A zone is checked ten times a second, so for fast objects test the line between two positions instead.

## Where to go next

- [Objects and effects](/guides/world/objects-and-effects/) for placing objects and moving them by hand.
- [Quidditch](/guides/quidditch/running-a-match/) for a match built from physics objects.
