---
title: Doors
description: Hold the game's doors locked, unlocked, open or closed for every player, share the locks players open, find a door's name, and decide when a locked door opens for someone.
sidebar:
  order: 520
---

Hogwarts and Overland are full of the game's own doors and locks, and each player's game normally keeps their state in that player's save. The server can take over any of them, so that a door is locked or open for everyone.

Portcullises, the Astronomy rune gate, goblin camp gates and crawl grates are not doors, and no `Doors` call reaches them. See [Gates](/guides/world/gates/).

## Holding a door's state

`Doors.set(selector, state)` holds a door's lock, its open state or both, for every player:

```js
// server/main.js
Doors.set(vaultDoor, { locked: true, open: null });
Doors.set(hallDoor, { locked: null, open: true });
```

| Field | `true` | `false` | `null` |
| --- | --- | --- | --- |
| `locked` | Held locked. Only a door that has a lock can be locked. | Held unlocked | Left to each player's save |
| `open` | Held open | Held closed; it still swings for anyone who walks into it unless it is locked | Left to swing on its own |

At runtime a field you leave out keeps whatever the server already holds for it, but the current type declarations ask for both fields, so pass `null` for the one you mean to leave to the game.

Each player's game re-applies what the server holds as the door streams in, so players who arrive later see it too.

- `Doors.get(selector)` returns the state held under a selector, and `Doors.list()` every held state.
- `Doors.clear(selector)` releases a selector, and `Doors.clearAll()` releases them all. A released door keeps its current state until it streams in again, when each player's save takes over.
- A selector left holding nothing, with both fields `null`, is released.
- Each leaf of a double door is its own door and swings on its own, so hold both leaves to keep a double door shut.

## Finding a door

A selector names one door, or several, in one of three ways:

| Selector | Matches |
| --- | --- |
| An actor name | Every placed door with that name, which may be several |
| A persistent id, `<name>:<guid>` | Exactly one door, even where names repeat |
| Its full path, holding `/` | The placement at that path, which also tells apart doors sharing a name |

To learn a door's name and id, stand next to it with a client script that lists the doors around the player:

```js
// client/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  for (const door of Doors.list(800)) {
    console.log(`${door.name} id=${door.id} locked=${door.locked} ${Math.round(door.dist)} cm away`);
  }
});
```

`Doors.list(radius)` returns each loaded door within `radius` centimetres, 3000 by default, with its name, persistent id, full path, distance and lock state. The output goes to the [client log](/guides/getting-started/debugging/#where-output-goes).

## When a player unlocks a door

When a player opens a lock with a key or Alohomora, the server holds that door unlocked for everyone, under its persistent id or, without one, its path. `Doors.setShareUnlocks(false)` keeps each unlock in the player's own game instead, and `Doors.getShareUnlocks()` reads the setting.

Either way the server raises `doorUnlocked` with the player and the door: its `name`, persistent `id`, `path` and whether the unlock was `shared`. `id` is empty for a lock that is not on a door.

```js
// server/main.js
Events.on("doorUnlocked", (player, door) => {
  if (!door.shared) return;
  Chat.sendToAll(`${player.nickname} unlocked ${door.name} for everyone.`);
});
```

`Doors.set` or `Doors.clear` on that selector takes a shared unlock back. An unlock is not shared while the server holds the door locked.

## When a player tries a locked door

When a player tries to open a lock the server holds shut, with a key or Alohomora, their game refuses at once and the server raises `doorUnlockRequest` with the player and the door: its `selector`, `name` and `id`. It fires at most once a second for each door. Release the lock there if the player should get in:

```js
// server/main.js
const vaultKeyHolders = new Set();

Events.on("doorUnlockRequest", (player, door) => {
  if (door.selector !== vaultDoor) return;
  if (vaultKeyHolders.has(player.id)) {
    Doors.set(vaultDoor, { locked: false, open: null });
  } else {
    player.sendChat("The vault does not open for you.");
  }
});
```

Unlocking with `Doors.set` unlocks the door for everyone, not only the player who asked.

- On a double door, `selector` may name the other leaf, when that leaf's held lock is what refused the player.
- A lock the player's own client policy keeps shut raises it too, with an empty `selector`.

## On the client

Client scripts can change doors too, but only for their own player, and the server's held state always wins:

- `Doors.setLocked(selector, locked)` locks or unlocks matching doors on this client only, until they stream in again.
- `Doors.setPolicy(policy)` keeps streamed doors unlocked or locked on this client: unlock all of them, a list, or all except a list, and lock a list, which beats any unlock.
- `Doors.superAlohomora(true)` lets every lock open to a key or Alohomora, whatever the player's Alohomora level, key-only locks included. Locks the server holds still refuse, and it is cleared on disconnect.
- `Doors.held()` lists the door states the server holds, as this client received them.

## With the doors resource

The `doors` resource holds the doors listed under `held` in its `doors.config.js` for everyone while it runs, and releases them when it stops. The file exports one object, `module.exports = { … }`:

```json5
{
  version: 1,
  held: {
    "BP_Door_BellTowers_EXT": { locked: false },
    "BP_Door_Template4:AQsMCQ0PAAUKCgQEBAgADQ": { open: true },
  },
  rules: [{ priority: 1000, action: "allow", doors: "*" }],
}
```

| Command | Does |
| --- | --- |
| `/listdoors [radius]` | Lists the doors near you, with their names and ids, in the F8 console |
| `/doorset <name\|id\|path> <locked\|unlocked\|open\|closed\|release>` | Holds a door's state for everyone. Needs the staff or admin role. |
| `/doorsheld` | Lists every door state the server holds |

The same resource handles gates with `heldGates`, `gates:` rules and its gate commands. See [Gates](/guides/world/gates/#with-the-doors-resource).

## Where to go next

- [Gates](/guides/world/gates/) for portcullises, the rune gate, camp gates and crawl grates.
- [Loot](/guides/world/loot/) for chests behind your doors.
- [Authority](/guides/core-concepts/authority/) for why a request like `doorUnlockRequest` is the server's to decide.
