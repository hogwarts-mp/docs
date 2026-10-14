---
title: Zones
description: Mark out areas of the world on the server and get an event when players or other entities come in or go out.
sidebar:
  order: 465
---

A zone is an area of the world that the server watches. It raises an event when a player, or another kind of entity you ask for, comes in or goes out. A zone does nothing else by itself: a safe zone, an arena or a shop counter is your handlers reacting to those events.

## Creating a zone

`Zone.create(key, shape, options)` creates a zone under a key, or replaces the one there, and returns it:

```js
// server/main.js
const square = Zone.create("market:square", {
  type: "cylinder",
  center: { x: 12000, y: -4500, z: 200 },
  radius: 4000,
  height: 1500,
});
```

Shapes are in world centimetres:

| `type` | Fields |
| --- | --- |
| `"sphere"` | `center`, `radius` |
| `"box"` | `center`, `size` (full lengths along each axis), `yaw` in degrees |
| `"cylinder"` | `center` (the middle of its base), `radius`, `height` |
| `"polygon"` | `points`, 3 to 64 corners as `{ x, y }` whose edges do not cross, and `minZ`, `maxZ` |

The options are:

- `virtualWorld`: the [world](/guides/core-concepts/virtual-worlds/) it watches, 0 by default. A zone matches entities in exactly that world. Players match only in Overland, since anywhere else their world is combined with their map.
- `track`: which entities it notices, from `"player"`, `"npc"`, `"beast"`, `"worldObject"` and `"character"`, by default only players.

A malformed shape or option throws. The server holds at most 4096 zones.

Keys are shared by every resource, and creating a zone under a key in use replaces that zone, so start yours with your resource's name. `Zone.get(key)` returns a zone or `undefined`, `Zone.getAll()` lists them, and `Zone.destroy(key)` or `zone.destroy()` removes one.

## Coming and going

`zoneEnter` fires with the zone and the entity that came in. `zoneExit` fires with the zone, the entity, a reason and the entity's id: the reason is `"left"` when it moved out, or out of the zone's world, and `"gone"` when it no longer exists, such as a player who disconnected, and then the entity is `null`. Every resource receives every zone's events, so check the key:

```js
// server/main.js
Events.on("zoneEnter", (zone, entity) => {
  if (zone.key === "market:square" && entity instanceof Player) entity.sendChat("Welcome to the market.");
});

Events.on("zoneExit", (zone, entity, reason) => {
  if (zone.key === "market:square" && reason === "left" && entity instanceof Player) entity.sendChat("Come again.");
});
```

Zones are checked ten times a second. An entity that moves through a zone between two checks still enters and leaves it, but one that moves more than 50 m between checks, such as a teleport, only counts where it lands.

`zone.getPlayers()` and `zone.getEntities()` list what was inside at the last check, and `zone.contains(point)` tests a point, ignoring worlds.

## A safe zone

A zone that turns PvP off inside it pairs the zone's events with a [PvP policy](/guides/pvp/hits-and-defeat/#the-policy-hook):

```js
// server/main.js
const SAFE = "market:safe";
const inSafeZone = new Set();

Zone.create(SAFE, { type: "sphere", center: { x: 12000, y: -4500, z: 200 }, radius: 3000 });

Events.on("zoneEnter", (zone, entity) => {
  if (zone.key === SAFE && entity) inSafeZone.add(entity.id);
});
Events.on("zoneExit", (zone, entity, reason, entityId) => {
  if (zone.key === SAFE) inSafeZone.delete(entityId);
});

Pvp.setPolicy((hit) => (inSafeZone.has(hit.casterId) || inSafeZone.has(hit.victimId) ? false : undefined));
```

The positions a zone tests are those players' games report, so treat what a zone tells you about a player like any other position they send.

## Lifetime

A resource's zones are destroyed when it stops, without `zoneExit`. Zone ids are never reused while the server runs.

## Where to go next

- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for which world a zone sees.
- [PvP rules and relations](/guides/pvp/rules-and-relations/) for deciding who may fight where.
