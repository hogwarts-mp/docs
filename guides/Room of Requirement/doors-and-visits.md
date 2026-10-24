---
title: Doors and visits
description: Decide where each player's door to the Room of Requirement leads, let players in through it or take them into rooms directly, invite visitors, and know who is in which room.
sidebar:
  order: 560
---

Players reach the Room of Requirement by fast travel, or through its door in the castle when a script lets them in. Where they arrive is up to the server: each player has a destination, the room their door leads to, and the server can also take a player into any room at once.

## Destinations

`Sanctuary.setDestination(player, id)` sets the room a player's door and fast travel lead to, and `null` leads nowhere. `Sanctuary.destination(player)` reads it back.

A destination can be set before its room is loaded. The door stays shut for that player until the room loads, so set it first and load the room from your store afterwards. Changing a player's destination while they are in a room takes effect once they leave.

## Taking a player in

`Sanctuary.enter(player, id)` takes a player into a room now, behind the game's loading screen, from anywhere in Overland or from another room, which it swaps in place. It returns `false` when no room is loaded under that id, and leaves the player's destination as it was.

```js
// server/main.js
function bringInto(player, id) {
  if (!Sanctuary.enter(player, id)) player.sendChat("That room is not open.");
}
```

There is no call to take a player out. They leave by the room's own exit, or you move them with `player.fastTravel`.

## Visitors

There are no invitations as such: a visitor is a player whose destination is someone else's room, or whom you take there. This keeps a list of who each player has invited, and lets invited players set their door to a friend's room:

```js
// server/main.js
const invited = new Map(); // room id -> Set of player ids

Events.on("chatCommand", (player, message, command, args) => {
  if (command === "invite" && args[0]) {
    const guest = PlayerManager.getAll().find((p) => p.nickname === args[0]);
    if (!guest) return player.sendChat(`Nobody called ${args[0]} is here.`);
    const room = roomOf(player);
    if (!invited.has(room)) invited.set(room, new Set());
    invited.get(room).add(guest.id);
    guest.sendChat(`${player.nickname} invited you to their room. Type /visit ${player.nickname}.`);
  }

  if (command === "visit" && args[0]) {
    const host = PlayerManager.getAll().find((p) => p.nickname === args[0]);
    if (!host || !invited.get(roomOf(host))?.has(player.id)) return player.sendChat("You have not been invited.");
    Sanctuary.setDestination(player, roomOf(host));
    player.sendChat(`The door now leads to ${host.nickname}'s room.`);
  }

  if (command === "home") Sanctuary.setDestination(player, roomOf(player));
});
```

`roomOf` is the room id from [Rooms](/guides/room-of-requirement/rooms/#loading-a-room). Destinations, edit rights and door access belong to the player's connection, and are gone when they reconnect, so set them again on `playerConnect`.

## The door

The door in the castle is one door that everyone sees. `Sanctuary.setDoor(mode)` sets when it shows, for everyone:

| Mode | The door |
| --- | --- |
| `"proximity"` | Appears while any player stands at it, and everyone watching sees it appear. The default. |
| `"open"` | Always shows |
| `"closed"` | Never shows, so nobody walks in |

Going through is decided per player. `Sanctuary.doorAccess(player)` is true when a player may: they have access, and their destination is loaded. `Sanctuary.setDoorAccess(player, false)` takes a player's access away, and `true` gives it back. A player without access still makes the door appear and sees it, but cannot go through.

### Letting players in

The game's own walk-in through the door, with its F prompt, is off by default. The door still appears, but nobody goes through it until a script takes them in: the client shows its own prompt at the door, and the server calls `Sanctuary.enter`. `Sanctuary.setNativeEntry(true)` turns the game's walk-in back on for players with access, and `Sanctuary.nativeEntry()` reads the setting.

On the client, `Sanctuary.door()` reports the door as this player sees it:

| Field | Meaning |
| --- | --- |
| `found` | The door is loaded |
| `shown` | It is showing |
| `localNear` | This player stands at it |
| `access` | This player's door access |
| `nativeEntry` | The game's own walk-in is on |
| `x`, `y`, `z` | Where to anchor a prompt, in world centimetres. 0 until the door is found. |

This client script shows a prompt at the door, and asks the server to take the player in when they press F:

```js
// client/main.js
let atDoor = false;

setInterval(() => {
  const door = Sanctuary.door();
  const want = door.found && door.shown && door.localNear && door.access && !door.nativeEntry;
  if (want === atDoor) return;
  atDoor = want;
  if (want) Hud.showPrompt(Key.getLabel("f"), "Enter", door.x, door.y, door.z);
  else Hud.hidePrompt();
}, 250);

Key.bind("f", () => {
  if (atDoor) Events.emitServer("room:door");
});
```

The server checks again that the player stands at the door and has access, since any client can send the request. Which room they enter is yours to choose. This takes them to their destination:

```js
// server/main.js
const DOOR = { x: 348658, y: -458032, z: -79920 }; // the door, in Overland
const lastTrip = new Map(); // player id -> when their last trip began

Events.onClient("room:door", (player) => {
  const at = player.location();
  if (at?.areaId !== "Overland" || Math.hypot(at.x - DOOR.x, at.y - DOOR.y, at.z - DOOR.z) > 600) return;
  if (Date.now() - (lastTrip.get(player.id) ?? 0) < 5000) return; // one trip, however often they press F
  const id = Sanctuary.destination(player);
  if (id && Sanctuary.doorAccess(player) && Sanctuary.enter(player, id)) lastTrip.set(player.id, Date.now());
});

Events.on("playerDisconnect", (player) => lastTrip.delete(player.id));
```

### Keeping players out

The door is not a lock. Fast travel to the Room of Requirement ignores door access and native entry, and the door itself is drawn by each player's game. What keeps a player out of a room is that the server only sends a room to players whose destination it is, who are entering it or who are in it. To bar a player, clear their destination as well.

## Who is where

`Sanctuary.inside(player)` returns the room a player is in, or `null`, and `Sanctuary.occupants(id)` lists the players in a room. `playerSanctuaryEnter` and `playerSanctuaryLeave` fire with the player and the room's id. Swapping rooms raises a leave for the old room and then an enter for the new one, and a player who disconnects inside a room leaves it before `playerDisconnect` fires.

The server only knows a player is inside once their game has finished loading the room, so `inside` stays `null` through the loading screen.

## Who sees whom

Each room is its own [virtual world](/guides/core-concepts/virtual-worlds/), combined with the player's world number. Players in the same room with the same world number see and hear each other, and nobody in another room. The global world `4294967295` still sees into every room.

`setVirtualWorld` places an entity in a map's world, never in one particular room. An NPC or beast created with a `preferredOwnerId` starts in that player's world and map, and so in their room.

## Where to go next

- [Rooms](/guides/room-of-requirement/rooms/) for loading, decorating and saving rooms.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for how worlds and maps combine.
- [Interaction prompts](/guides/user-interface/hud-and-nametags/#interaction-prompts) for the prompt a door script shows.
