---
title: Moving NPCs and creatures
description: Walk NPCs, beasts and characters along paths of waypoints, have a beast follow someone, choose what each does when it has nowhere to go, and hear arrivals through events.
sidebar:
  order: 410
---

The server can walk the NPCs, beasts and characters it spawns: along a path of waypoints, to a single point, or, for a beast, after someone. A guard can patrol a wall, a house-elf can pace the kitchens and a hippogriff can follow the player who looks after it. The three kinds share one path format and the same calls, but each walks its own way.

## How each kind walks

| | NPC | Beast | Character |
| --- | --- | --- | --- |
| What walks it | Its owner's game, with the game's own pathfinding | Its owner's game, with the game's own creature AI | The server, which every player's game follows |
| Between points | Finds its way round obstacles | Finds its way round obstacles, or flies | A straight line |
| With no player near | The path holds until a player comes near | The path holds until a player comes near | It keeps walking |
| Arrivals reported by | The owner's game | The owner's game | The server |

An NPC's or beast's owner is the nearby player whose game runs its AI (see [Who runs the AI](/guides/npcs-and-creatures/npcs/#who-runs-the-ai)). Because that game reports the arrivals, treat an NPC's or beast's path events like anything else a client reports.

## Paths

`moveAlong(waypoints, options)` walks the entity through 1 to 64 waypoints in order, and `moveTo(x, y, z, options)` walks it to one point. Either replaces the path it was on.

A waypoint is a player's position, as `player.position` reads it, about 90 cm above the floor, so a spot a player stood on can be used as it is:

```js
// server/main.js
const patrol = []; // points marked with /mark

Events.on("chatCommand", (player, message, command) => {
  if (command === "mark") {
    const { x, y, z } = player.position;
    patrol.push({ x, y, z, wait: 4 });
    player.sendChat(`Patrol point ${patrol.length} marked.`);
  } else if (command === "patrol" && patrol.length > 0) {
    const { x, y, z } = patrol[0];
    const guard = NPC.create("Goblin_Grunt", x, y, z, "friendly");
    guard?.moveAlong(patrol, { loop: "pingpong" });
  }
});
```

| Waypoint field | Meaning |
| --- | --- |
| `x`, `y`, `z` | Where to go, in world centimetres |
| `wait` | Seconds to stand there on arrival, 0 to 3600 |
| `gait` | `"walk"`, `"jog"` or `"sprint"`: the pace of the leg that arrives there |

| Option | Meaning |
| --- | --- |
| `gait` | The pace of every leg whose waypoint names none: `"walk"` by default, or a beast's own `gait` |
| `loop` | `"once"`, the default, ends at the last point; `"loop"` walks from the last point back to the first and round again; `"pingpong"` walks back and forth along the points |

A path with one point always runs once, and a `"loop"` or `"pingpong"` path runs until you stop or replace it. A malformed path throws: no points or more than 64, a missing coordinate, an unknown gait or a wait out of range. `moveAlong` and `moveTo` return `false` when the entity is gone, or the NPC is dead. Each kind adds options of its own, in its section below.

`pause()` holds a path where it is, and `resume()` carries on from there. `stop()` ends the path and leaves the entity where it is.

### Reading a path

`entity.movement` reads where its path stands:

| Field | Meaning |
| --- | --- |
| `mode` | `"path"` while a path runs, waits and pauses included; `"follow"` while a beast follows; `"idle"` otherwise |
| `waypoint` | The index of the point it is walking to or waiting at |
| `waypoints` | How many points the path has; 0 when idle |
| `lap` | How many laps a `"loop"` or `"pingpong"` path has completed |
| `paused` | Whether `pause()`, or an NPC's or beast's `aiPaused`, holds it |

`entity.waypoints` returns the running path's points as you gave them, each with the gait it walks at filled in (a character's with its `speed`), or an empty array.

## Path events

Each kind raises its own pair of events:

| Event | Handler arguments | When it fires |
| --- | --- | --- |
| `npcWaypoint`, `beastWaypoint`, `characterWaypoint` | `(entity, index, lap)` | It reaches `waypoints[index]`, before the wait there |
| `npcMoveEnded`, `beastMoveEnded`, `characterMoveEnded` | `(entity, reason)` | Its path ends |

`lap` counts completed laps, so on a `"loop"` path the arrival back at point 0 reports lap 1. `reason` says why the path ended:

| Reason | Meaning |
| --- | --- |
| `"arrived"` | A `"once"` path reached its last point and finished the wait there |
| `"stopped"` | `stop()` ended it, a script set a beast's or character's `position`, or the NPC died |
| `"replaced"` | A new path, or a beast's new command, took over. It fires before the new path's events |
| `"unreachable"` | NPCs and beasts: the game found no way to a point |
| `"targetGone"` | Beasts: the entity it was following left |

Destroying an entity ends its path without an event.

```js
// server/main.js
Events.on("beastWaypoint", (beast, index, lap) => {
  if (index === 0 && lap === 3) beast.stop("relax"); // three laps, then a rest
});

Events.on("npcMoveEnded", (npc, reason) => {
  if (reason === "unreachable") npc.destroy();
});
```

## What other players see

A character's path travels with it: its points, when it started and whether it is paused. A player who comes into range mid-path sees the character where everyone else does, partway along a leg, because every player's game plays the walk on the server's clock. On the server, `character.position` follows the walk, and a client script reads where a character is on its own player's screen with `Character.pose(id)`.

An NPC's or beast's path is held on the server, and its owner's game walks it; everyone else sees it move as they see any NPC. When the owner changes, the new owner's game carries on from the next waypoint, or finishes the wait it was in, so no arrival is reported twice.

## NPCs

An NPC walks with the game's own pathfinding and its family's own gaits: walk is its calm wander, jog its combat move, and sprint that move at 1.3 times the speed. Its options add:

| Option | Meaning |
| --- | --- |
| `radius` | How near a point counts as reached, 0 to 5000 cm; the game's own, about 50, by default |
| `speedScale` | The game's own speed scale for every leg, 0.25 to 3; 1 by default. Jog and sprint follow it, and the calm walk keeps its stride |
| `then` | The idle a `"once"` path ends in: `"stand"` by default. See [Idling](#idling) |

A fight takes over. An NPC that gets into one holds its path and carries on once it is calm again. `pause()`, `aiPaused` and `movementFrozen` hold the path too, and stop the clock of a wait (see [Switching behaviour off](/guides/npcs-and-creatures/npcs/#switching-behaviour-off)).

### Idling

`npc.idle` decides what an NPC does while no path runs:

| Idle | What it does |
| --- | --- |
| `"native"` | The game's own: it wanders where it spawned. The default |
| `"stand"` | Holds at its home, and walks back whenever it ends up more than 3 m away, such as after a fight |
| `"wander"` | Roams around its home |

`npc.home` is that home, a player's position, or `null` until one is set. The first `"stand"` or `"wander"` makes the spot the NPC stands on its home, and you can set it yourself. A `"once"` path that arrives moves the home to its last point and takes up the path's `then` idle, so by default an NPC stands guard where its path ends:

```js
// server/main.js
Events.on("chatCommand", (player, message, command) => {
  if (command !== "guard") return;
  const { x, y, z } = player.position;
  const guard = NPC.create("Goblin_Grunt", x + 1500, y, z, "friendly");
  guard?.moveTo(x, y, z, { gait: "jog" }); // then stands guard here
});
```

## Beasts

A beast walks through the game's own creature AI, at its species' own walk, jog and sprint. Ground moves need the game's navmesh, which covers Overland, Hogwarts and the vivariums.

| Property | Meaning |
| --- | --- |
| `gait` | The gait `moveAlong`, `moveTo` and `follow` use when they name none: `"walk"` by default |
| `idle` | What it does with no command: `"relax"`, the default, stays near where it was put, sitting and lying; `"wander"` explores, grazes and rests around its area; `"stand"` stands |
| `area` | A sphere it idles inside, as `{ x, y, z, radius }` with the radius in centimetres, or `null`. The game picks its idle spots inside it, and it walks back if it ends up outside. Paths and follows are not limited by it |

A beast's path options add `then`, the idle a `"once"` path ends in, which becomes `beast.idle`: `"stand"` by default. `beast.stop(then)` takes one too, also `"stand"` by default, so a stopped beast stands unless you name another idle.

`pause()` holds an idle beast still too. `aiPaused` holds its whole AI, across new commands, until you set it back to `false`. Setting `beast.position` teleports it and ends its path or follow as `"stopped"`.

### Following

`beast.follow(target, options)` walks after a player, beast, NPC or character and keeps about 1.5 m off, until `stop()` or a new command. It throws for anything else, and for the beast itself. While it follows a player in its own virtual world, that player's game runs it. `movement.targetId` is the id of the entity it follows.

| Option | Meaning |
| --- | --- |
| `gait` | As on a path |
| `teleportBeyond` | Metres behind the target past which the server puts the beast beside it: 60 by default, 0 never |
| `air` | Fliers only: fly after the target while it is airborne or more than 30 m away, about 4 m behind and 3 m above it, and land beside it once it is back on the ground nearby |

```js
// server/main.js
const pets = new Map(); // player id -> their beast

Events.on("chatCommand", (player, message, command) => {
  const pet = pets.get(player.id);
  if (!pet) return;
  if (command === "heel") {
    const canFly = Beast.catalog().find((species) => species.id === pet.species)?.canFly ?? false;
    pet.follow(player, { gait: "jog", air: canFly });
  } else if (command === "stay") {
    pet.stop("relax");
  }
});
```

### Flying

Fliers can reach points in the air. `Beast.catalog()` marks them `canFly`: the adult Fwooper, Hippogriff, Jobberknoll, Phoenix and Thestral. Add `air: true` to a waypoint, or to `moveTo`'s options, to fly there; a ground point after air points lands there. `air` throws for a beast that cannot fly. Flight needs the game's flight volumes, which the castle's interior lacks. `movement.flying` reads whether a beast is in the air now.

## Characters

A character has no AI, so the server plays its path. It walks from where it stands to each point in a straight line at a steady speed, so lay points out where nothing is in the way. Its path runs whether anyone is near or not, and each body walks on its own animations, a ghost or a centaur as much as a townsperson.

Its gaits are fixed speeds: walk is 150 cm/s, jog 475 and sprint 700. Waypoints and options can name a speed instead:

| Waypoint field | Meaning |
| --- | --- |
| `speed` | The speed of the leg that arrives there, 20 to 1000 cm/s, instead of a gait |
| `yaw` | The heading to turn to while it waits there, in degrees; by default it keeps facing the way it walked |

| Option | Meaning |
| --- | --- |
| `speed` | The speed of every leg that names none, 20 to 1000 cm/s, instead of `gait` |
| `ground` | `"snap"`, the default, stands the body on the floor under it in each player's game, and uses the path's height where there is none; `"path"` follows the heights you gave |
| `turnRate` | How fast it turns at corners and waits, 1 to 3600 degrees a second: 270 by default |

A new path starts from wherever the character is, even partway along a leg. `pause()` stops the walk's clock and its events until `resume()`. Setting `character.position` moves it there on every player's screen and ends its path as `"stopped"`.

`Character.isMovable(characterId)` tells whether a body can walk. The Sorting Hat, the Howler and the busts cannot, and `moveAlong` and `moveTo` throw for them.

```js
// server/main.js
const crier = Character.create("town-crier", "T3TownspersonMale1", { x, y, z, label: "Town crier" });

// Up the street and back, turning round to face the way it came at each end.
crier?.moveAlong([
  { x: x + 1200, y, z, wait: 30, yaw: 180 },
  { x, y, z, wait: 30, yaw: 0 },
], { loop: "loop" });

Events.on("characterWaypoint", (character) => {
  if (character.id === crier?.id) announceNear(character.position, "Hear ye! The market opens at noon.");
});
```

## Where to go next

- [NPCs](/guides/npcs-and-creatures/npcs/) for who runs an NPC's AI and switching its behaviour off.
- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for spawning beasts and the bodies a character can have.
- [Authority](/guides/core-concepts/authority/#what-clients-report) for what an owner's game reports and how far to trust it.
