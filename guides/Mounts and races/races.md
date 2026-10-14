---
title: Races
description: Run the game's broom races on tracks of your own, for several players at once, with the server keeping the time.
sidebar:
  order: 81
---

The game has broom races of its own, with rings to fly through, turbo bubbles and a pace ghost. Client scripts can take one of these races, give it a track of your own and start it, with the `Races` global. `Races` is experimental, and it works on the local player only: each racer's client runs its own copy of the race, and the server ties them together.

## How a race works

Each race in the game is an object standing at its starting pad, named like `BRR_01`, the one near the Hogwarts Quidditch pitch. `Races.list()` lists the races loaded around the player, and a race is only loaded while the player is near its pad, so bring racers there before you start. The fast-travel point `M_FT_BRR_01` is at that race's pad, so `player.fastTravel("M_FT_BRR_01")` on the server takes a player there.

To run one, a client:

1. Gives the race your track with `Races.setTrack(raceId, points)`: at least three world positions, in centimetres. The race puts its rings along the track.
2. Turns off the race's leash with `Races.setLeash(raceId, false)`. The leash pulls riders back towards the curve through the track's points.
3. Keeps the race loaded along the whole track with `Races.fitBounds(raceId, points)`. The game unloads a race once the player leaves the area around its pad, and takes its rings with it.
4. Starts it with `Races.start(raceId)`. The race puts the player on their broom itself, so they need to own one: [give them a broom](/guides/mounts-and-races/brooms-and-mounts/#what-players-own) first, and check with `Races.hasBroom()`.

`Races.spawnBoosts(raceId, fractions)` adds turbo bubbles at points along the track, given as fractions from 0 at the start to 1 at the finish. `Races.getTrack(raceId)` reads a race's track, and `Races.active()` returns the race the player is in.

`Races.setLeash(raceId)` with no second argument also turns the leash off.

## Racing together

Each racer runs their own copy of the race, so the server sends every racer the same track. Their rings then stand in the same places, and they see each other fly the course. Another racer cannot fly through your rings for you, but they can pick up your turbo bubbles. Players who are not racing see the racers, but none of the rings.

The server keeps the time. A client's race clock stops when the game pauses, so it cannot be compared between players, and a time a client reports can be made up. Each client tells the server when its own countdown ends and when it finishes, and the server times the gap.

`Races.watchEvents()` turns on the race's events, which arrive as `gameEvent` with the name of the game function that fired. The ones a race needs are `OnRaceCountdownComplete`, `OnRaceFinish` and `OnRaceAbandoned`. The same name can fire more than once, so take the first one.

```js
// client/main.js
Races.watchEvents();

Events.on("race:begin", (race) => {
  if (!Races.list().some((loaded) => loaded.raceId === race.raceId)) {
    Events.emitServer("race:failed", { reason: "too far from the start" });
    return;
  }
  Races.setTrack(race.raceId, race.points);
  Races.setLeash(race.raceId, false);
  Races.fitBounds(race.raceId, race.points);
  if (Races.start(race.raceId)) Races.spawnBoosts(race.raceId, [0.25, 0.5, 0.75]);
});

Events.on("gameEvent", (functionName) => {
  if (functionName === "OnRaceCountdownComplete") Events.emitServer("race:started");
  if (functionName === "OnRaceFinish") Events.emitServer("race:finished");
});
```

```js
// server/main.js
const racers = new Map(); // player id -> { started, finished }

function startRace(players, points) {
  for (const player of players) {
    racers.set(player.id, { started: 0, finished: 0 });
    player.emit("race:begin", JSON.stringify({ raceId: "BRR_01", points }));
  }
}

Events.onClient("race:started", (player) => {
  const racer = racers.get(player.id);
  if (racer && !racer.started) racer.started = Date.now();
});

Events.onClient("race:finished", (player) => {
  const racer = racers.get(player.id);
  if (!racer || !racer.started || racer.finished) return;
  racer.finished = Date.now();
  const seconds = ((racer.finished - racer.started) / 1000).toFixed(1);
  Chat.sendToAll(`${player.nickname} finished in ${seconds} seconds.`);
});
```

Give the race a time limit on the server too, and count anyone who has not finished by then as out.

## Cleaning up

Boosts and the bigger loading area belong to the client, not to your resource. `Races.clearBoosts()` removes the bubbles and `Races.restoreBounds()` puts the race's area back, so call both when a race ends and as your resource stops. A race that has started keeps running if your resource stops.

```js
// client/main.js
Events.on("resourceStop", (resourceName) => {
  if (resourceName !== "broom-races") return;
  Races.clearBoosts();
  Races.restoreBounds();
});
```

`Races.abandon(raceId)` force-ends a race that will not finish, and `Races.clearGhosts()` and `Races.hideHud()` clear a pace ghost or a race display left behind by one.

## Where to go next

- [Brooms and mounts](/guides/mounts-and-races/brooms-and-mounts/) for giving players brooms and controlling how they fly.
- [Quidditch](/guides/mounts-and-races/quidditch/) for balls, hoops and a snitch.
