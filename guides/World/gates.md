---
title: Gates
description: Open, close and lock the game's portcullises, the Astronomy rune gate, goblin camp gates and crawl grates, for everyone or for one player.
sidebar:
  order: 525
---

Besides its doors, the game has gates: portcullises, a rune-puzzle gate, goblin camp gates and the grates over goblin crawl spaces. Gates are not doors. Each kind is its own actor, so no `Doors` call reaches a gate and no `Gates` call reaches a door. The server can hold a gate's state for everyone, and a client script can change gates for its own player.

## The four kinds

| `kind` | Gates | Opens | Closes | Locks |
| --- | --- | --- | --- | --- |
| `portcullis` | The Clocktower, outer wall and dungeon portcullises | Yes | Yes | Yes |
| `runeGate` | The rune gate from the Astronomy Class quest, `BP_ZZS_TundraGate_2` | Yes, skipping its puzzle | Yes | No |
| `swingGate` | Goblin camp gates | Yes | Yes | No |
| `crawlGrate` | Breakable grates over goblin crawl spaces | Yes, by breaking it | No | No |

- An unlocked portcullis stays down, rises as a player walks up to it and lowers a second after the last one leaves. An open one stays raised.
- The rune gate lets players through about 7 seconds after it starts to open.
- Opening a crawl grate breaks it, which cannot be undone.

## Finding a gate

To learn a gate's name, stand near it with a client script that lists the gates around the player:

```js
// client/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  for (const gate of Gates.list(3000)) {
    console.log(`${gate.kind} ${gate.name} open=${gate.isOpen} locked=${gate.isLocked} ${Math.round(gate.dist)} cm away`);
  }
});
```

`Gates.list(radius, kind)` returns the loaded gates within `radius` centimetres, nearest first. A `radius` of 0, the default, returns every loaded gate, and `kind` narrows the list to one kind or an array of them. The output goes to the [client log](/guides/getting-started/debugging/#where-output-goes).

| Field | Meaning |
| --- | --- |
| `name` | The actor name. Several placements can share one. |
| `path` | The full path name, which belongs to one placement |
| `kind` | One of the four kinds above |
| `dist`, `bearing` | Centimetres from the player, -1 when unknown, and degrees off the player's facing, 999 when unknown |
| `x`, `y`, `z` | World position, left out when the gate could not be located |
| `isOpen` | Open or opening. The rune gate reads `true` once it no longer blocks the way. |
| `isLocked` | The portcullis lock, or `null` for a kind without one |
| `canClose` | Whether it can be closed. `false` for a crawl grate. |
| `canLock` | Whether it can be locked. `true` only for a portcullis. |
| `lift` | How far open, from 0 to 1, or `null` where that cannot be measured |
| `hasBeenOpened`, `useSchedule`, `wantsToOpen` | Portcullis only: whether walking up to it raises it, whether the clock still moves it, and whether it stays raised after players walk through |

Every `Gates` call that takes a selector reads it as an actor name, which can match several placements, or as a path name when it holds `/` or `:`, which matches one.

## Holding a gate's state

`Gates.set(selector, state)` holds a gate's lock, its open state or both, for every player:

```js
// server/main.js
Gates.set("BP_ZZS_TundraGate_2", { locked: null, open: true });
Gates.set("BP_HW_ClocktowerPortcullis2", { locked: true, open: null });
```

| Field | `true` | `false` | `null` |
| --- | --- | --- | --- |
| `locked` | Held locked and closed. A kind without a lock is held closed instead. | Held unlocked | Left to each player's save and gate policy |
| `open` | Held open | Held closed. A crawl grate cannot close. | Left to each player's game |

As with `Doors.set`, a field you leave out keeps whatever the server already holds for it at runtime, but the current type declarations ask for both fields, so pass `null` for the one you mean to leave to the game.

Each player's game applies the held state when it arrives and again whenever a matching gate streams in, whatever that player's save or gate policy says.

- A held lock beats a held open.
- Only a portcullis can be held shut. A player can still open any other gate held closed their own way, by its puzzle, a spell or Interact, until it next streams in.
- `Gates.get(selector)` returns the state held under a selector, and `Gates.list()` every held state.
- `Gates.clear(selector)` releases a selector, and `Gates.clearAll()` releases them all, other resources' included. A released gate keeps its current state until it streams in again.
- A selector left holding nothing, with both fields `null`, is released. A malformed selector or a field that is not a boolean or `null` throws a `TypeError`.

## On the client

Client scripts can change gates for their own player. A change lasts until the gate streams in again, and the server's held state always wins:

```js
// client/main.js
const opened = Gates.setOpen("BP_ZZS_TundraGate_2", true);
if (opened === 0) console.log("The rune gate is not loaded.");
```

- `Gates.setOpen(selector, open)` opens, and unlocks, or closes matching gates.
- `Gates.setLocked(selector, locked)` locks, and closes, or unlocks matching portcullises.
- `Gates.freezeSchedule(selector)` takes matching portcullises off the clock.

Each returns how many loaded gates matched and support the call, so closing a crawl grate or locking a camp gate counts 0.

### A policy for each player

`Gates.setPolicy(policy)` keeps gates open, unlocked or locked on this client, on every loaded gate now and on each gate as it streams in:

```js
// client/main.js
Gates.setPolicy({
  unlockAll: ["portcullis"],
  openAll: ["swingGate"],
  freezeSchedule: true,
  lockGates: ["BP_HW_ClocktowerPortcullis_2", "BP_HW_ClocktowerPortcullis2", "BP_HW_ClocktowerPortcullis_LOD2"],
});
```

| Field | Meaning |
| --- | --- |
| `unlockAll` | `true`, or a list of kinds: unlock every gate of those kinds and leave it closed |
| `openAll` | `true`, or a list of kinds: open every gate of those kinds, and keep a portcullis raised |
| `allExcept` | Gates that `unlockAll` and `openAll` skip |
| `unlockGates` | Gates to unlock, whatever their kind |
| `openGates` | Gates to open, whatever their kind |
| `lockGates` | Gates to close and lock. This beats any unlock or open in the policy. A kind without a lock is closed instead, until the player opens it their own way. |
| `freezeSchedule` | Take every portcullis off the clock |

Each call replaces the policy before it and returns how many loaded gates it checked. `Gates.policy()` returns the policy last set, with `true` spelled out as all four kinds and every list present. `Gates.held()` lists the gate states the server holds, as this client received them.

Each field the server holds overrides the policy for that gate. A lock still beats an open, so a gate the policy locks stays shut while the server only holds it open. Hold it `{ locked: false, open: true }` to open it for everyone.

## With the doors resource

The `doors` resource handles gates beside doors. Its `doors.config.js` exports one object, `module.exports = { … }`, with keys like these:

```json5
{
  version: 1,
  gateSchedule: "freeze",
  heldGates: {
    "BP_ZZS_TundraGate_2": { open: true },
  },
  rules: [
    { priority: 1000, action: "allow", gates: "*", kind: "portcullis" },
    { priority: 900, action: "allow", gates: "*", kind: "swingGate", open: true },
    { priority: 500, action: "deny", gates: ["BP_HW_ClocktowerPortcullis_2", "BP_HW_ClocktowerPortcullis2", "BP_HW_ClocktowerPortcullis_LOD2"], lock: true },
  ],
}
```

A `gates:` rule takes a list of names or `"*"` and follows the same priority and allow/deny rules as a `doors:` rule. An allow unlocks a gate and leaves it closed. Three modifiers apply to `gates:` rules only:

- `kind` on a `"*"` rule limits it to one kind or an array of them. Without it, `"*"` covers every kind. A rule that names gates applies to them whatever their kind.
- `open: true` on an allow opens the gate instead of only unlocking it.
- `lock: true` on a deny closes and locks the gate, instead of only leaving it out of a wider allow.

`heldGates` holds gates for everyone through `Gates.set` while the resource runs, and releases them when it stops. `gateSchedule` is `"freeze"` by default, which takes every portcullis off the clock, or `"local"` to leave the game's schedule alone.

| Command | Does |
| --- | --- |
| `/listgates [radius]` | Lists the loaded gates, with their kind and state, in the F8 console |
| `/gate <name\|path> [open\|close\|lock\|unlock]` | Changes one gate on your own client |
| `/freezegates [name\|*]` | Takes portcullises off the clock on your own client |
| `/gateset <name\|path> <locked\|unlocked\|open\|closed\|release>` | Holds a gate's state for everyone. Needs the staff or admin role. |
| `/gatesheld` | Lists every gate state the server holds |

## Things to watch for

- **The Clocktower gate is three actors:** `BP_HW_ClocktowerPortcullis_2`, the one players walk through, plus the distant copies `BP_HW_ClocktowerPortcullis2` and `BP_HW_ClocktowerPortcullis_LOD2`. A rule or selector that names it must list all three, or use `"*"` with `kind: "portcullis"`.
- **Scope wide opens with `kind`.** `openAll: true`, or an `open: true` rule on `"*"` without a `kind`, breaks every crawl grate and skips the rune gate's puzzle.
- **Freeze portcullis schedules.** Most portcullises rise at 06:00 and lower at 20:00 on each player's own game clock, which the server's [shared clock](/guides/world/time-and-weather/#the-clock-and-calendar) does not drive, so two players can see the same gate in different places. Set `freezeSchedule: true` in the policy, or keep the doors resource's `gateSchedule: "freeze"`.
- **A gate a player opens their own way is not shared.** Solving the rune gate's puzzle, breaking a grate with a spell or opening a camp gate with Interact changes it in that player's game only, and the server is not told. Hold the gate open with `Gates.set` when everyone should find it open.

## Where to go next

- [Doors](/guides/world/doors/) for the game's doors and locks.
- [Time and weather](/guides/world/time-and-weather/) for the shared clock.
