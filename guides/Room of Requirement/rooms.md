---
title: Rooms
description: Load rooms of the Room of Requirement under ids of your own, let players decorate them, and save what they build.
sidebar:
  order: 550
---

The Room of Requirement holds as many rooms as the server loads. A room is a layout, the objects players have conjured and changed there, stored under an id your script chooses. The `Sanctuary` global on the server loads rooms, decides who may decorate them and who goes into which.

Nobody owns a room unless your script says so. "Every player has a room of their own" is a few lines of script: load a room for each player as they join, make it where their door leads, and let them edit it.

## Loading a room

`Sanctuary.load(id, layout)` creates a room under an id, or replaces the one there. An id is any string of 1 to 128 characters. An empty room is a layout with nothing in it:

```js
// server/main.js
const EMPTY_ROOM = { version: 1, objects: [], locks: {}, lighting: "" };

function roomOf(player) {
  return `room:${player.id}`;
}

Events.on("playerConnect", (player) => {
  const id = roomOf(player);
  if (Sanctuary.revision(id) === null) Sanctuary.load(id, EMPTY_ROOM);
  Sanctuary.setDestination(player, id);
  Sanctuary.setEditor(id, player, true);
});
```

`Sanctuary.ids()` lists every loaded room, and `Sanctuary.revision(id)` returns a room's revision, or `null` when no room is loaded under that id. `Sanctuary.unload(id)` drops a room, and refuses while anyone is inside it, entering it or has it as their destination. `load` throws for a malformed layout.

Players see each other's rooms only through your script, so choose ids that say nothing private. Every player taken into a room can read its id.

## Decorating

`Sanctuary.setEditor(id, player, true)` lets a player change a room with the game's own spells: conjuring, moving, resizing, recolouring and vanishing pieces, unlocking parts of the room and choosing its lighting. They need the spells and the moonstones to cast them, as in the game. `Sanctuary.editors(id)` lists who may edit a room.

Edit rights belong to the player's connection: they last until the player disconnects, whether or not the room is loaded, so grant them again when the player comes back.

Moving, conjuring, recolouring and vanishing reach everyone in the room within a second or so. Unlocked parts and lighting appear for everyone else the next time they enter. Players without edit rights can still cast in a room, but nothing they change is kept, and it is gone the next time they enter.

The server checks that an edit is well formed, not that it makes sense, so a player you let edit can put anything anywhere in their room.

## Saving rooms

Rooms live in the server's memory. They survive your resource restarting, and are gone when the server stops. To keep them, save each room as it changes and load it again when you need it.

`sanctuaryChanged` fires with the room's id, its new revision and the player who edited it, after every accepted edit. An editor's game reports changes twice a second while they work, so wait for a pause before saving. `Sanctuary.get(id)` returns the room's layout, ready to store as JSON:

```js
// server/main.js
const pendingSaves = new Map(); // room id -> timer

Events.on("sanctuaryChanged", (id) => {
  clearTimeout(pendingSaves.get(id));
  pendingSaves.set(id, setTimeout(() => {
    pendingSaves.delete(id);
    const layout = Sanctuary.get(id);
    if (layout) saveRoom(id, JSON.stringify(layout));
  }, 2000));
});
```

`saveRoom` stands for your own store. Load a saved room before you need it, and only when it is not loaded already: loading over a room that is still in memory replaces it with the saved copy, which can be a few seconds behind. `load` itself does not raise `sanctuaryChanged`.

## What a layout holds

| Field | Holds |
| --- | --- |
| `version` | 1 |
| `objects` | Every conjured or changed piece: its type, position, rotation, scale and colour. A piece of the room's own that was vanished has the type `"None"`. |
| `locks` | Which parts of the room are unlocked: the expansions, the biomes, the initial dressing and lighting |
| `lighting` | The lighting style: `"Default"`, `"Potnr"`, `"Hbgst"`, `"Mzoo"` or `"Dwiz"` (the potioneer's, herbologist's, magizoologist's and dark wizard's) |

A room holds at most 8192 objects. A layout does not hold what goes on at the room's stations, its beasts, who may edit it or where anyone's door leads.

Give every layout its `locks` and `lighting`. A layout that leaves them empty keeps whatever the player's game had from the last room they were in.

## Where to go next

- [Doors and visits](/guides/room-of-requirement/doors-and-visits/) for getting players in and out of rooms.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for who sees whom inside a room.
