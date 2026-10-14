---
title: Line traces
description: Cast a line through the world from a client script to find what it hits first, such as what the player is looking at, the ground under a point or whether a spot is in sight.
sidebar:
  order: 540
---

A line trace follows a straight line through the world and reports the first thing it hits. `World.lineTrace(start, end, options)` traces on the client, through the world the player's game has loaded. The server has no world of its own to trace, so a client traces and sends the server what it found, which the server treats like anything else a client reports.

## Tracing

```js
// client/main.js
const from = LocalPlayer.getPosition();
if (from) {
  const hit = World.lineTrace(from, { x: from.x, y: from.y, z: from.z - 10000 });
  if (hit) console.log(`ground ${hit.distance} cm below, on ${hit.surface}`);
}
```

`start` and `end` are world positions in centimetres. A trace returns the first hit, or `null` when the line hits nothing, including when it runs into an area the player's game has not loaded. A malformed argument throws.

## What it hits

By default a trace stops where the game's visibility checks stop: the ground, buildings and objects, and players' bodies, where it also names the bone it hit. The options change that:

| Option | Default | Does |
| --- | --- | --- |
| `channel` | `"visibility"` | `"camera"` passes through players, as the game's camera does |
| `objectTypes` | | Stops only on these kinds of thing instead, such as `["worldStatic"]` for the level, `["pawn"]` for characters or `["shallowWater", "deepWater"]` for water. It cannot be combined with `channel`, and it also stops on trigger volumes. |
| `ignore` | | Ids of players, NPCs, objects, beasts or characters to pass through |
| `ignoreSelf` | `true` | Passes through the local player |
| `complex` | `false` | Traces against detailed collision rather than the simple shapes |

## What a hit says

| Field | Meaning |
| --- | --- |
| `location`, `normal` | Where it hit and the surface's direction there; on flat ground, `normal.z` is close to 1 |
| `distance` | How far from `start`, in centimetres |
| `surface` | What the surface is made of, such as `"Grass"`, `"Stone"`, `"Wood"` or `"Water"`, or `null` |
| `objectType` | The kind of thing hit, such as `"worldStatic"` |
| `entity` | For a player, NPC, world object, beast or character, its `type` and `id`, the same id the server uses; `null` for the level and anything else |
| `bone` | The bone hit on a body, or `null` |
| `startPenetrating` | Whether the line started inside what it hit; its `normal` is then unreliable |

`actor` and `component` name the game's own objects, and the names differ between players' games.

## What the player is looking at

Trace along the camera's view. `Camera.capture()` returns where the camera is and which way it faces:

```js
// client/main.js
const RAD = Math.PI / 180;

function lookingAt(range = 5000) {
  const view = Camera.capture();
  if (!view) return null;
  const pitch = view.rotation.pitch * RAD;
  const yaw = view.rotation.yaw * RAD;
  const start = view.position;
  return World.lineTrace(start, {
    x: start.x + Math.cos(pitch) * Math.cos(yaw) * range,
    y: start.y + Math.cos(pitch) * Math.sin(yaw) * range,
    z: start.z + Math.sin(pitch) * range,
  });
}

Key.bind("f", () => {
  const hit = lookingAt();
  if (hit && hit.entity) Events.emitServer("inspect", { type: hit.entity.type, id: hit.entity.id });
});
```

## The ground under a point

```js
// client/main.js
function groundHeight(x, y, z) {
  const hit = World.lineTrace({ x, y, z: z + 100 }, { x, y, z: z - 10000 }, { objectTypes: ["worldStatic", "shallowWater", "deepWater"] });
  return hit && !hit.startPenetrating ? hit.location.z : null;
}
```

`null` means the ground is not loaded there, or is more than 100 m down.

## Line of sight

Tracing on the camera channel from the camera to a point, ignoring the thing you are looking for, tells you whether anything solid is in between. Players do not block it:

```js
// client/main.js
Events.on("sight:check", (target) => {
  const eye = Camera.capture();
  if (!eye) return;
  const blocker = World.lineTrace(eye.position, { x: target.x, y: target.y, z: target.z + 60 }, { channel: "camera", ignore: [target.id] });
  Events.emitServer("sight:result", { id: target.id, visible: blocker === null });
});
```

Each trace is one check on the game's own collision, cheap enough for a few every frame.

## Where to go next

- [Camera](/guides/camera-and-sound/camera/) for where the player's view is.
- [Authority](/guides/core-concepts/authority/) for treating what a client sends as a claim.
