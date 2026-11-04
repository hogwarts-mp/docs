---
title: Time and weather
description: Set the shared clock, calendar, season and weather every player sees, change how fast time passes, pin holiday decor, the Headmaster's office and the Great Hall's meals and banners, and give one player a sky of their own.
sidebar:
  order: 500
---

The server owns one world state that every client follows: the clock, the calendar, the season, the weather, holiday decor, the Headmaster's office, the meals on the tables and the banners in the Great Hall. Each player's game shows what the server sets, so everyone sees the same sky, unless a client script [overrides it](#on-the-client) for its own player.

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

`World.setHeadmasterOffice(office)` pins the gargoyle staircase to the Headmaster's office for every player: `"open"` raises it, `"closed"` keeps it down, and `"game"`, the default, leaves it to the story quest. A loaded staircase follows at once: `"closed"` folds the stairs away, sinks the gargoyle and closes the stairwell off again. Going back to `"game"` leaves the staircase as it is until the quest changes it.

## Meals

`World.setMeal(meal)` sets the food on the tables of the Great Hall and the Kitchens for every player, and `World.meal` reads it back:

| Meal | Tables |
| --- | --- |
| `"game"` | Follow the clock, the default: breakfast at 6:00, lunch at 11:00, dinner at 16:00, dessert at 19:00, cleared at 20:00 |
| `"breakfast"`, `"lunch"`, `"dinner"`, `"dessert"` | That meal, whatever the time |
| `"prep"` | Plates and goblets, with no food |
| `"none"` | Bare |

```js
// server/main.js
function startFeast() {
  World.setMeal("dessert");
}

function endFeast() {
  World.setMeal("game");
}
```

A meal you set holds through mealtimes. Any other value returns `false`.

## The Great Hall's banners

`World.setGreatHallBanners(banners)` hangs one house's banners at the head of the Great Hall for every player, and `World.greatHallBanners` reads it back:

| Value | Effect |
| --- | --- |
| `"Gryffindor"`, `"Hufflepuff"`, `"Ravenclaw"`, `"Slytherin"` | Hangs that house's banners. The house name is matched in any case. |
| `"none"` | Takes them down |
| `"game"` (the default) | Stops pinning and leaves them to the story, which never hangs a house's |

A change unfurls the new house's banners in place, with the game's own reveal. Every client re-applies the setting whenever its world loads or a mission changes the banners, and going back to `"game"` leaves them as they are until a mission changes them. Any other value returns `false`. The game removes the banners for good once a player's save has completed the story mission `FGB_01`.

```js
// server/main.js
Events.on("housePointsChange", (house, points, previous) => {
  // The first house to reach 500 points wins the cup.
  if (previous < 500 && points >= 500 && World.greatHallBanners === "game") {
    World.setGreatHallBanners(house);
    Chat.sendToAll(`${house} wins the House Cup!`);
  }
});
```

## Reacting to changes

`World.revision` increases whenever the world state changes, for a resource that wants to notice another resource's changes. The setters change the state at once, and players' games follow within moments.

## On the client

A client script can show its own player a different sky from everyone else's, such as clear daylight while the character creator is open. `World.setLocalOverride(override)` lays its fields over the server's, on this client only:

| Field | Shows |
| --- | --- |
| `weather` | A weather preset, as `World.setWeather` takes on the server |
| `hour`, `minute` | A time of day, `hour` from 0 to 23 and `minute` from 0 to 59. This client's clock stops there. `minute` needs `hour`, and is 0 when you leave it out. |
| `season` | 0 for spring to 3 for winter, as `World.setSeason` takes |

```js
// client/main.js
Events.on("creatorOpened", () => {
  World.setLocalOverride({ weather: "Clear", hour: 12, season: 1 });
});

Events.on("creatorConfirmed", () => World.clearLocalOverride());
Events.on("creatorCancelled", () => World.clearLocalOverride());
```

Fields you leave out follow the server, and the date always does. Setting or clearing the override shows at once, without the game's usual blend from one weather to the next. A field of the wrong type or out of range throws a `TypeError`, and an empty object clears the override.

- A client has one override, not one per resource: each call replaces the last, whichever resource made it.
- It lasts until `World.clearLocalOverride()`, or until the resource that set it stops.
- `World.localOverride()` returns it, with the resource that set it as `owner`, or `null` while the server's sky shows.
- The server and other players are not told. Their clock, season and weather stay as the server set them.

## Where to go next

- [State bags](/guides/core-concepts/state-bags/#world-state) for your own server-wide values, on `World.state`.
- [Loot](/guides/world/loot/) for switching off the game's own loot, or running its moonstone deposits and foragables from the server.
