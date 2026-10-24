---
title: Map markers
description: Put markers, search circles and gold routes on the map and minimap, read the player's own waypoint, choose which players get a blip and in what colour, and read what the minimap shows.
sidebar:
  order: 620
---

The game's map and minimap draw a blip for every other player, and client scripts can add markers and circles of their own and draw the game's gold route to one. All of this lives on each client, in the `Blips` global, so the server decides what each player should see and tells their client.

## Markers and circles

`Blips.setMarker(key, x, y, z, icon, label)` puts a marker at a world position, in centimetres. `Blips.setCircle(key, x, y, z, radius)` draws a search circle instead, with its radius in **metres**, 50 by default.

The key is a name of your choosing. Setting the same key again moves or restyles that blip rather than adding another, so a moving target is a repeated `setMarker`. `Blips.remove(key)` takes one away. Leave `icon` out for the game's default marker icon.

```js
// client/main.js
Blips.setMarker("hunt:clue", 15200, -3400, 250, undefined, "Next clue");
Blips.setCircle("hunt:area", 15200, -3400, 250, 40);
Blips.pulseCircle("hunt:area", true);
```

`Blips.pulseCircle(key, true)` makes a circle pulse, and `false` fades it in instead. `Blips.inArea(key, x, y, z)` tells you whether a point is inside a circle.

### Who owns a blip

Blips belong to the client, not to the resource that set them. Every resource shares one set of keys, so prefix yours with something your own, and `Blips.clear()` removes every script blip, whichever resource set it. Stopping your resource leaves its blips on the map; only disconnecting clears them.

Keep the list on the server and send it to clients, including players who join after a blip went up:

```js
// server/main.js
const markers = new Map(); // key -> { key, x, y, z, label }

function showMarker(marker) {
  markers.set(marker.key, marker);
  Events.emitAllClients("marker:set", marker);
}

function hideMarker(key) {
  markers.delete(key);
  Events.emitAllClients("marker:remove", { key });
}

// A client asks for the whole set once its script is running.
Events.onClient("marker:ready", (player) => {
  player.emit("marker:all", JSON.stringify([...markers.values()]));
});
```

```js
// client/main.js
Events.on("marker:set", (m) => Blips.setMarker(m.key, m.x, m.y, m.z, undefined, m.label));
Events.on("marker:remove", (m) => Blips.remove(m.key));
Events.on("marker:all", (list) => {
  for (const m of list) Blips.setMarker(m.key, m.x, m.y, m.z, undefined, m.label);
});

Events.emitServer("marker:ready");
```

A marker the server sends to everyone is on everyone's map. When a position should stay secret, such as the circle hunters are searching, send it only to the players meant to see it.

## Routes

`Blips.setRoute(target, label)` draws the game's gold mission route on the map and minimap, to a marker or circle by its key, or to another player's blip by their network id while they have one. It returns `false` when there is no such blip or the game did not take the route. Each client follows one route, so setting another replaces it:

```js
// client/main.js
Blips.setRoute("hunt:area", "Search for the clue");
```

- A route to a circle stops at its ring, so the player is led there and then searches inside it.
- It survives its blip being set again, so moving the circle to the next clue keeps the route on it.
- While the player has placed a waypoint of their own, their purple line takes over the minimap. The big map keeps drawing your route beside it.

`Blips.clearRoute()` ends the route, and removing its blip ends it too. `Blips.route()` returns the key or network id the route leads to, or `null`.

## The player's waypoint

Players drop a waypoint of their own on the game's map. It is theirs, not a blip, so the calls above never change it, but `Blips.waypoint()` reads it, or returns `null` when they have none:

| Field | Meaning |
| --- | --- |
| `x`, `y`, `z` | Where it is, in world centimetres |
| `target` | The beacon name of the map icon it was dropped on, such as `"FT_HW_GreatHall"`; `null` on open ground |

Dropped on an icon, the waypoint sits exactly on it. On open ground, `z` is the height of the map's model under the cursor: close to the terrain, but not on it. Find [the ground under it](/guides/world/line-traces/#the-ground-under-a-point) before you stand someone there.

The `waypointChanged` event fires with the new waypoint and the previous one each time the player places, moves or removes theirs, and a removal reports `null`. It only reports changes, so read `Blips.waypoint()` as your script starts for one placed before. This party shares each member's waypoint with the others:

```js
// client/main.js
Events.on("waypointChanged", (waypoint) => Events.emitServer("party:waypoint", waypoint));

Events.on("party:waypoint", (payload) => {
  const key = `party:waypoint:${payload.playerId}`;
  const at = payload.waypoint;
  if (at) Blips.setMarker(key, at.x, at.y, at.z, undefined, payload.name);
  else Blips.remove(key);
});
```

```js
// server/main.js
Events.onClient("party:waypoint", (player, waypoint) => {
  const valid = waypoint && [waypoint.x, waypoint.y, waypoint.z].every(Number.isFinite);
  const at = valid ? { x: waypoint.x, y: waypoint.y, z: waypoint.z } : null;
  const payload = JSON.stringify({ playerId: player.id, name: player.nickname, waypoint: at });
  for (const member of partyMembers(player)) {
    if (member !== player) member.emit("party:waypoint", payload);
  }
});
```

## Player blips

Every other player has a blip by default. To show only some of them, turn that off and name the players who keep theirs:

```js
// client/main.js
Events.on("party:members", (payload) => {
  Blips.trackAllPlayers(false);
  Blips.setTrackedPlayers(payload.memberIds);
});
```

`Blips.trackPlayer(networkId, enabled)` adds or removes one player, and works before that player has spawned. `Blips.trackedPlayers()` lists the network ids that have a blip.

`Blips.setPlayerColor(networkId, r, g, b, a)` colours one player's blip, with components from 0 to 1. Leave out the colour to go back to their house colour. `Blips.setAllPlayerColors(r, g, b, a)` colours every blip, and `Blips.setBlipScale(scale)` sizes them.

Hiding a blip hides an icon, not a player: their position still reaches the client. To keep players apart, use [virtual worlds](/guides/core-concepts/virtual-worlds/), and to hide one from everyone, `player.setVisible(false)` on the server, which takes their blip with them.

## The minimap

`Minimap.state()` reports what the game's own minimap is drawing:

| Field | Meaning |
| --- | --- |
| `map` | The region on screen: `"overland"`, `"hogwarts"`, `"hogsmeade"`, `"dungeon"`, `"tutorial"`, `"sanctuary"`, `"tents"`, or `"none"` behind a load screen |
| `floor` | In Hogwarts, the floor the game picked for the player, counting from 0; `null` elsewhere |
| `texture` | In Hogwarts, the floor's map tile; `null` elsewhere |

The `minimapChanged` event fires with the new state and the previous one whenever any of them changes. `Minimap.floorAt(z)` returns the Hogwarts floor the game would pick at a height, for placing other things on floors the way the game places the player.

```js
// client/main.js
Events.on("minimapChanged", (state, previous) => {
  if (state.map === "hogwarts" && previous.map !== "hogwarts") Game.notify("Welcome back to the castle.");
});
```

## Where to go next

- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) for the rest of the game's HUD.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for keeping groups of players apart.
