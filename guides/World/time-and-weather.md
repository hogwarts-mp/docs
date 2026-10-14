---
title: Time and weather
description: Set the shared clock, calendar, season and weather every player sees, change how fast time passes, and pin holiday decor and the Headmaster's office.
sidebar:
  order: 500
---

The server owns one world state that every client follows: the clock, the calendar, the season, the weather, holiday decor and the Headmaster's office. Each player's game shows what the server sets, so everyone sees the same sky.

## The clock and calendar

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.setTime(20, 30);
  World.setDate(31, 10);
  World.setTimeScale(2);
});
```

| Call | Sets |
| --- | --- |
| `World.setTime(hour, minute, second)` | The time of day. The clock keeps running from there. |
| `World.setDate(day, month, year)` | The date. Leave out `year`, or pass 0, to keep the game's own, around 1891. |
| `World.setTimeScale(minutesPerSecond)` | How many in-game minutes pass each real second, from 0 to 600. At 1, an in-game day lasts 24 real minutes; 0 stops the clock. |

`World.hour`, `World.minute`, `World.second`, `World.day`, `World.month`, `World.year` and `World.timeScale` read the current values. Each setter returns `false` for a value out of range.

A server starts at 11:00 on 12 June with a time scale of 1, and the clock is not saved: after a restart it starts there again unless your resource sets it.

## Season and weather

`World.setSeason(season)` takes 0 for spring, 1 for summer, 2 for autumn and 3 for winter, and `World.season` reads it back. A server starts in summer.

`World.setWeather(name)` sets the weather to one of the game's weather presets, and `World.weather` reads it back. A server starts on `Clear`. Some of the presets:

| Weather | Presets |
| --- | --- |
| Fair | `Clear`, `LightClouds_01` |
| Rain | `LightRain_01`, `Rainy`, `Stormy_01`, `StormyLarge_01` |
| Overcast and mist | `Overcast_01`, `Overcast_Heavy_01`, `Overcast_Windy_01`, `Misty_01`, `MistyOvercast_01` |
| Winter | `Winter_Overcast_01`, `Winter_Misty_01`, `Snow_01`, `SnowLight_01` |

The server does not check the name, so a misspelt preset is sent to every client as it is. Season and weather are set independently, so a snowy winter takes both:

```js
// server/main.js
function startWinter() {
  World.setSeason(3);
  World.setWeather("Snow_01");
}
```

## Holiday decor

`World.setDecor(decor)` pins the castle's and Hogsmeade's holiday decorations for every player:

| Value | Effect |
| --- | --- |
| `"halloween"`, `"christmas"` | Shows that holiday's decorations |
| `"none"` | Keeps both off |
| `"game"` (the default) | Stops pinning and leaves decor to the story missions |

Every client re-applies the decor whenever its world loads or a mission changes it. Winter's own garlands are not holiday decor: they follow the season.

## The Headmaster's office

`World.setHeadmasterOffice(office)` pins the gargoyle staircase to the Headmaster's office for every player: `"open"` raises it, `"closed"` keeps it down, and `"game"`, the default, leaves it to the story quest. A raised staircase stays up until its part of the castle reloads, so `"closed"` takes effect on a player's next visit there.

## Reacting to changes

`World.revision` increases whenever the world state changes, for a resource that wants to notice another resource's changes. The setters change the state at once, and players' games follow within moments.

## Where to go next

- [State bags](/guides/core-concepts/state-bags/#world-state) for your own server-wide values, on `World.state`.
- [Loot](/guides/world/loot/) for switching off the game's own loot with `World.suppressLoot`.
