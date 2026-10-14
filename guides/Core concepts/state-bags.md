---
title: State bags
description: Attach your own keys and values to players and other entities, choose which clients receive each key, and react when one changes.
sidebar:
  order: 220
---

Every replicated entity carries a state bag, `entity.state`: a small key/value store that the server writes and that travels with the entity to the clients that can see it. Players, NPCs, beasts, world objects, effects and characters all have one, and `World.state` is a bag for state that belongs to no entity.

Use a state bag for data clients need to show about an entity, such as a player's team, a score or an NPC's label, without sending your own events to every client that might be looking.

## Writing state

Only the server writes. `set` stores a value and returns `true` when it changed, and `remove` drops a key:

```js
// server/main.js
Events.on("playerConnect", (player) => {
  player.state.set("team", "gryffindor");
  player.state.set("score", 0);
});

function addScore(player, points) {
  player.state.set("score", player.state.get("score") + points);
}
```

Booleans, numbers and strings are stored as themselves. Anything else is stored as JSON and read back as a parsed copy, so store plain data: changing an object after you set it does not change the stored value.

| Limit | |
| --- | --- |
| Key | 1 to 64 bytes of UTF-8 |
| Value | Up to 4096 bytes, as stored |
| Keys per entity | Up to 128 |

`set` throws when a write would break one of them.

## Who receives a key

The third argument chooses which clients a key reaches:

| Scope | Reaches |
| --- | --- |
| `"broadcast"` (the default) | Every client that can see the entity |
| `"owner"` | Only the entity's owner: for a player, their own client; for an NPC or beast, the client running its AI |
| `"server"` | No client. The key stays on the server. |

```js
// server/main.js
player.state.set("questStage", 4, { scope: "owner" });
player.state.set("lastWarning", Date.now(), { scope: "server" });
```

A key with the `"server"` scope is server-side storage that lives and dies with the entity.

A client that starts seeing an entity, because it came into range or the player just joined, receives the entity's current keys at once. A client that becomes an entity's owner receives its `"owner"` keys, and a client that stops being the owner loses them. Several writes to a key within one server tick reach clients as one change, carrying the last value.

## Reading state

Both sides read with `get`, `has`, `keys` and `toObject`. A client cannot write.

```js
// client/main.js
function teamOf(entity) {
  return entity.state.has("team") ? entity.state.get("team") : "none";
}
```

## Reacting to changes

`onChange` watches one entity, either one key or every key when you pass `null`, and returns a function that stops watching. Its handler receives the key, the new value and the previous one. The subscription ends when your resource stops.

```js
// server/main.js
const stop = player.state.onChange("score", (key, value, previous) => {
  if (value >= 100 && previous < 100) Chat.sendToAll(`${player.nickname} reached 100 points!`);
});
```

The `entityStateChange` event reports every change on every entity. On the server it fires when a script writes; on a client it fires when a change arrives, including each key of an entity that has just come into view, with `previous` set to `undefined`:

```js
// client/main.js
Events.on("entityStateChange", (entity, key, value, previous) => {
  if (key === "score") updateScoreboard(entity.id, value, previous);
});
```

In both handlers `value` is `undefined` when the key was removed and `previous` is `undefined` when the key held nothing before.

## World state

`World.state` holds state for the whole server, and every client receives its broadcast keys. It is `null` until the server's networking is up, so read it inside handlers rather than at the top of a script. `World.stateId` is the id of the entity that carries it, for telling its changes apart in `entityStateChange`:

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.state?.set("round", { number: 1, endsAt: Date.now() + 5 * 60 * 1000 });
});
```

```js
// client/main.js
Events.on("entityStateChange", (entity, key, value) => {
  if (entity.id === World.stateId && key === "round") showRound(value.number, value.endsAt);
});
```

## State is not storage

State bags live in memory. A player's state is gone when they disconnect, an entity's when it is destroyed, and all of it when the server stops. Save anything that must outlast them in your own store, as [Persisting state](/guides/getting-started/first-resource/#persisting-state) describes.

## Where to go next

- [Authority](/guides/core-concepts/authority/) for what the server owns and what clients only report.
- [Events](/guides/core-concepts/events/) for sending data that does not belong to an entity.
