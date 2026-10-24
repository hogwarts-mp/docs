---
title: Hogwarts Express
description: Run the Hogwarts Express along its track from the server, stop it at Hogsmeade station and send it on, and follow each run through events.
sidebar:
  order: 535
---

The Hogwarts Express runs on one track through Overland, past Hogsmeade station. On a HogwartsMP server the game's own timetable is off on every player's game, so the train only comes when a script runs it. `World.hogwartsExpress` runs it from the server, and every player sees it at the same spot on the track, players who arrive mid-run included.

## Positions on the track

A position is `t`, from 0 to 1 along the track. At 0 the whole train stands just on the track, south of Hogsmeade. At 1 it stands at the far end. `length` is the metres from 0 to 1, about 2.9 km, so a difference in `t` times `length` is a distance.

`stops` lists named spots as `{ id, t }`. There is one, `"hogsmeade"`, which stops the train along the station's platform. Every call that takes a position takes a `t` or a stop's id.

The train runs forward only. It cannot move to a spot behind it; spawn it there again instead.

## Running the train

```js
// server/main.js
const express = World.hogwartsExpress;

express.spawn(0);
express.moveTo("hogsmeade", { speed: 25 });
```

| Call | Does |
| --- | --- |
| `spawn(at)` | Stands the train at `at`, 0 by default, replacing one already out |
| `moveTo(at, options)` | Runs the train from wherever it is, standing or moving, and brakes it to a stop on `at`. It replaces a move or departure under way |
| `depart(options)` | Runs the train off the far end at its cruise speed. It is removed there |
| `halt(options)` | Brakes a moving train to a stop wherever that lands, never past the spot a `moveTo` was heading for |
| `despawn()` | Removes the train at once |

Each returns `false`, without throwing, when it is refused: there is no train, the spot is behind it, a `t` is outside 0 to 1 or a stop's id is unknown, or an option is out of range. `halt` is also refused for a train that is not moving. Once a departing train passes the end of the track, `moveTo`, `depart` and `halt` refuse it.

`moveTo` and `depart` take the same options:

| Option | Meaning |
| --- | --- |
| `speed` | Cruise speed in metres per second: 20 by default, the game's own, up to 60 |
| `accel` | How hard it pulls away, in m/s²: 0.5 by default, up to 10 |
| `decel` | How hard it brakes, in m/s²: 0.7 by default, up to 10 |

A spot too close to stop on at `decel` brakes harder, so the train still stops on it. On a departure, `decel` only slows a train that is faster than `speed` down to it. `halt` takes `decel` alone, and `halt({ decel: Infinity })` stops the train dead. Speeds and times are real, whatever the [clock](/guides/world/time-and-weather/#the-clock-and-calendar)'s time scale.

### Where the train is

`get()` reads the train now:

| Field | Meaning |
| --- | --- |
| `spawned` | Whether a train is out |
| `moving`, `departing` | Whether it is running, and whether that run takes it off the end |
| `t`, `speed` | Where it is and how fast it goes, in m/s, while it is out |
| `target` | The `t` it is braking onto, or `null` |
| `seconds` | Seconds until it stops, or until a departure leaves the track; `null` while it stands |

## Train events

| Event | Handler arguments | When it fires |
| --- | --- | --- |
| `trainSpawned` | `(t)` | `spawn` stood the train at `t` |
| `trainStopped` | `(t)` | The train braked to a stop at `t`, at the end of a `moveTo` or a `halt` |
| `trainEnded` | `(reason)` | The train is gone: `"end"` when a departure left the track, `"despawned"` after `despawn()` or a `spawn()` that replaced it |

After a `moveTo` to a stop, `trainStopped` passes that stop's `t` from `stops`. A `t` you passed as a number can come back very slightly rounded, so compare it with a small margin rather than `===`.

```js
// server/main.js
const express = World.hogwartsExpress;
const hogsmeade = express.stops.find((stop) => stop.id === "hogsmeade");

function runToHogsmeade() {
  if (express.get().spawned) return false;
  return express.spawn(0) && express.moveTo("hogsmeade");
}

Events.on("trainStopped", (t) => {
  if (!hogsmeade || Math.abs(t - hogsmeade.t) > 0.001) return;
  Chat.sendToAll("The Hogwarts Express is at Hogsmeade. It leaves in two minutes.");
  setTimeout(() => express.depart(), 120000);
});

Events.on("trainEnded", (reason) => {
  if (reason === "end") Chat.sendToAll("The Hogwarts Express has gone.");
});
```

There is one train for the whole server. Every resource can move it and receives its events, so let one resource run it.

## Who sees it

- Every player on Overland sees the train, in every virtual world. It is not an entity you place in a world.
- A player in a dungeon or another map does not see it. Back on Overland, they see it where it is by then, as a player who joins mid-run does.
- The train belongs to the server, not to a resource. Stopping the resource that ran it leaves the train as it is, standing or still running.

## With Foundations

HMP Foundations' [`hmp-express`](https://github.com/hogwarts-mp/foundations/tree/main/resources/hmp-express) puts a timetable back. At each departure, in in-game time on the server's clock, it stands the train at the start of the track, runs it to each stop, waits there and sends it off the far end. Its `data/hmp-express.json` holds:

| Key | Meaning |
| --- | --- |
| `enabled` | `false` leaves the train to your own script |
| `departures` | Each departure's `time`, as `"HH:MM"`, and the `days` of the week it runs on, every day when left out. By default the game's own: 10:00 on Monday, Wednesday and Friday, and 21:00 on Saturday |
| `stops` | Where the train stands on the way, in track order: `at`, a stop's id or a `t`, and `dwellSeconds`, 120 by default. `[]`, the default, drives straight through, as the game does |
| `speed`, `accel`, `decel` | As for `moveTo` |
| `year` | The year the day of the week is taken from while the server keeps the game's own year: 1891 by default |

A departure due while the train is still out is skipped. Other resources can drive the train through its `train` export, which takes that train off the timetable until it is gone. To run the train from your own script instead, set `enabled` to `false`.

## Where to go next

- [Time and weather](/guides/world/time-and-weather/) for the server's clock and calendar, which a timetable runs on.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/#what-ignores-worlds) for the other things every player sees whatever their world.
- [Travel between places](/guides/players/travel/) for maps, and moving players between them.
