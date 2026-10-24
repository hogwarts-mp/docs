---
title: Shapes
description: Draw rings, spheres, boxes, cylinders, polygons and lines in the world from a client script, to show areas, mark spots and see what your code is doing.
sidebar:
  order: 545
---

`Shapes` draws simple shapes into the world on one player's screen: rings, spheres, boxes, cylinders, polygons and lines. Use them to show where an area's edges are, mark a spot, preview where something will go, or see a line trace while you work on it.

A shape is drawn by the client script that creates it, and only that player sees it. To show one to several players, the server tells each of their clients what to draw. Shapes are part of the scene rather than an overlay, so walls and the ground hide them. They have no collision, and they are unlit, so they keep their colour at night.

## Drawing a shape

```js
// client/main.js
Shapes.create("market:edge", {
  type: "ring",
  center: { x: 12000, y: -4500, z: 200 },
  radius: 3000,
  ground: true,
  color: { r: 1, g: 0.8, b: 0.2 },
  fill: { r: 1, g: 0.8, b: 0.2, a: 0.15 },
});
```

`Shapes.create(key, shape)` draws a shape under a key of up to 128 characters, or replaces the one there, from the next frame. Positions and sizes are in world centimetres. A malformed shape throws a `TypeError`, and so does one with both `color` and `fill` set to `null`, which would draw nothing. A player's game holds at most 1024 shapes from all resources together, and one more throws an `Error`.

Keys belong to the resource that creates them, so two resources can use the same key without touching each other's shapes. A resource's shapes are destroyed when it stops.

## Types

| `type` | Fields it reads | Outline | `fill` |
| --- | --- | --- | --- |
| `"ring"` | `center`, `radius` | A flat circle | A disc |
| `"sphere"` | `center`, `radius` | Three circles round its centre | The sphere |
| `"box"` | `center`, `size`, `yaw` | Its twelve edges | Its six faces |
| `"cylinder"` | `center` (the middle of its base), `radius`, `height` | Its bottom and top circles | Its wall |
| `"polygon"` | `points`, `minZ`, `maxZ` | Its floor, and when it has height its top and corners | Its floor and walls |
| `"line"` | `from`, `to` | The line | Nothing: colour a line with `color` |

Faces draw on both sides, so a player inside a filled sphere or cylinder sees it around them.

## Options

| Option | Meaning |
| --- | --- |
| `center` | The centre of a ring, sphere or box, and the middle of a cylinder's base: `{ x: 0, y: 0, z: 0 }` by default. A `Vector3` works |
| `radius` | A ring's, sphere's or cylinder's radius |
| `size` | A box's full lengths along its own axes, as `{ x, y, z }`, before `yaw` |
| `yaw` | A box's turn about the vertical, in degrees, from +X toward +Y: 0 by default |
| `height` | How far a cylinder reaches up from its base |
| `points` | A polygon's 3 to 64 corners as `{ x, y }`, in order, with no edges crossing |
| `minZ`, `maxZ` | A polygon's floor and top. Leave out `maxZ` for a flat polygon at `minZ` |
| `from`, `to` | A line's ends, at least 1 cm apart |
| `thickness` | The width of every line drawn, up to 1000: 8 by default |
| `segments` | How many sides a ring's, sphere's or cylinder's circles have, from 3 to 256, so 6 draws a hexagon. `null`, the default, gives about one side per 30 cm of circumference, from 24 to 128 |
| `color` | The outline's colour: opaque white by default. `null` draws no outline |
| `fill` | The colour of the faces inside the outline: `null`, none, by default |
| `visible` | Whether it draws: `true` by default |
| `ground` | Drops it onto the ground below it. See [On the ground](#on-the-ground) |
| `attachTo` | Makes it follow the local player or an entity. See [Following an entity](#following-an-entity) |

`radius`, `size` and `height` must be more than 0.

A colour, a `ShapeColor`, is `{ r, g, b, a }`. Its channels are linear, from 0 to 1, and values above 1, up to 10, glow. `a` is its opacity, from 0 to 1 and 1 by default: below 1 the shape is see-through.

## Changing and removing shapes

`Shapes.update(key, changes)` changes the fields you pass and keeps the rest. It throws like `create`, and a shape's `type` cannot change: create it again under the same key instead. Moving a shape by its `center` or a line by both its ends, recolouring it and hiding it are cheap. Any change to its form, such as a new `radius` or a polygon's `points`, rebuilds it.

`Shapes.setVisible(key, visible)` hides or shows a shape without destroying it, and `Shapes.get(key)` returns its fields as they stand, defaults filled in, or `null`. `Shapes.destroy(key)` removes one. `update`, `setVisible` and `destroy` return `false` when no shape has the key. `Shapes.destroyAll()` removes all of the resource's shapes and returns how many there were, and `Shapes.keys()` lists their keys.

A shape stays when the player changes map, at the same coordinates in the new one. Destroy the shapes that only mean something in the old map.

## Following an entity

With `attachTo`, a shape follows the local player, as `"localPlayer"`, or the player, NPC, beast, world object or character with that id, the same id the server uses. Every position in it, from `center` to a polygon's `points` and `minZ`, is then an offset from the entity's position. It follows where the entity is, but does not turn with it. While the entity has no body on this player's game, such as when it is out of range, the shape is hidden. `attachTo: null` makes its positions world positions again.

```js
// client/main.js
Shapes.create("spell:range", {
  type: "ring",
  radius: 1500,
  attachTo: "localPlayer",
  ground: true,
  color: { r: 0.3, g: 0.6, b: 1, a: 0.8 },
});
```

## On the ground

`ground: true` drops a shape's origin onto the ground below it: the centre of a ring, sphere or box, a cylinder's base, a polygon's floor under its middle, or a line's start. The ground is looked for from 50 cm above that point to 10 m below, and with none there the shape stays at its own height. Bodies do not count, so a ring round a player lies on the floor under them. A grounded shape that follows an entity finds the ground again as it moves, over steps and slopes.

Only that one point is dropped, and the rest of the shape keeps its form. On a slope, part of a wide ring sinks into the hill, where the ground hides it, and part floats.

## Showing a zone

A [zone](/guides/encounters/zones/) cannot be seen. Its shape uses the same fields as a shape here, so the server can send `zone.getShape()` to a client to draw:

```js
// server/main.js
const arena = Zone.create("arena:floor", {
  type: "cylinder",
  center: { x: 12000, y: -4500, z: 200 },
  radius: 3000,
  height: 1500,
});

function showArena(player) {
  player.emit("arena:bounds", JSON.stringify(arena.getShape()));
}
```

```js
// client/main.js
const RED = { r: 1, g: 0.25, b: 0.2 };

Events.on("arena:bounds", (shape) => {
  Shapes.create("arena:bounds", {
    type: "cylinder",
    center: shape.center,
    radius: shape.radius,
    height: shape.height,
    color: RED,
    fill: { ...RED, a: 0.08 },
  });
});
```

## Debugging a line trace

A [line trace](/guides/world/line-traces/) is easier to get right when you can see it. This helper runs a trace and draws it: red when it hits nothing, green with a dot where it hits. Each call replaces the last drawing.

```js
// client/main.js
const HIT = { r: 0.2, g: 1, b: 0.3 };
const MISS = { r: 1, g: 0.2, b: 0.2 };

function debugTrace(start, end, options) {
  const hit = World.lineTrace(start, end, options);
  Shapes.create("debug:trace", { type: "line", from: start, to: end, thickness: 2, color: hit ? HIT : MISS });
  if (hit) Shapes.create("debug:hit", { type: "sphere", center: hit.location, radius: 10, color: null, fill: HIT });
  else Shapes.destroy("debug:hit");
  return hit;
}
```

## Where to go next

- [Zones](/guides/encounters/zones/) for areas the server watches for players coming and going.
- [Line traces](/guides/world/line-traces/) for finding what a line through the world hits.
- [Objects and effects](/guides/world/objects-and-effects/) for props and effects every nearby player sees.
- [Map markers](/guides/user-interface/map-markers/) for marking places on the map instead.
