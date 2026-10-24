---
title: Travel between places
description: Teleport within a map, fast travel to the game's own points, load any map, and reach places the game builds from several maps. Which call to use, and how each one reports back.
sidebar:
  order: 305
---

Hogwarts Legacy is not one map. Overland is one, and it holds the open world, the castle and Hogsmeade. Every dungeon is a map of its own, and a mod can add more. Players only see and hear others in the same map, so moving someone to another map also moves them out of everyone else's view (see [Virtual worlds](/guides/core-concepts/virtual-worlds/#worlds-and-maps)).

Four calls move a player. Each queues the move on the player's client and returns a request id, and an event reports how it went.

## Which call to use

| Call | Use it for | Where they land | Reported by |
| --- | --- | --- | --- |
| `player.teleport(x, y, z, options)` | A spot in the map the player is already in | The position you give | `playerTeleportComplete`, once they stand there |
| `player.fastTravel(name)` | Anywhere the game has a fast-travel point | The game's own point | `playerFastTravelComplete`, once the game accepts the trip |
| `player.travelToMap(map, options)` | Another map: a dungeon, a mod's map, or Overland at a spot | A position, a start tag, or the map's own start | `playerMapTravelComplete`, once they can play there |
| `player.travelToPlace(name)` | A place the game builds from several maps, such as the intro's Gringotts | The place's own spawn | `playerMapTravelComplete`, once they can play there |

- If the game has a fast-travel point there, use `fastTravel`. It is the game's own trip, with its own transition and landing.
- For another map, or an exact spot the game has no point for, use `travelToMap`. Within the map the player is already in, use `teleport`: `travelToMap` to that map reloads all of it just to move them.
- For a place no single map makes, use `travelToPlace`.

When something has to happen after the player arrives, such as starting an encounter, wait for `playerMapTravelComplete`. `playerFastTravelComplete` fires as soon as the game accepts the trip, before the player lands.

## Teleporting within a map

`player.teleport` moves a player to world coordinates in the map they are in, and never across maps. Its options and statuses are in [Join and spawn](/guides/players/join-and-spawn/#putting-players-in-place).

## Fast travel

`player.fastTravel(name)` takes one of the game's fast-travel ids, matched case-insensitively. The ids name Floo flames and other points the game travels to, such as `FT_CentralHogsmeade` or `FT_HW_GreatHall`. A trip to a point in a dungeon, such as `FT_DeathHallows`, changes maps too.

It returns 0 for a name it does not know, without asking the player's game. Otherwise `playerFastTravelComplete` reports the `status`:

| Status | Meaning |
| --- | --- |
| 0 | The game accepted the trip. It does not mean the player has arrived. |
| 1 | A newer request replaced this one. |
| 2 | The player's game could not travel yet. |
| 3 | Their game does not know the destination. |
| 4 | Their game never answered. |

```js
// server/main.js
Events.on("chatCommand", (player, message, command) => {
  if (command.toLowerCase() !== "hogsmeade") return;
  if (player.fastTravel("FT_CentralHogsmeade") === 0) player.sendChat("That destination does not exist.");
});
```

### Players' own fast travel

A player can also fast travel from their own map screen. `player.setFastTravelEnabled(false)` stops that for one player: their game dims every Floo flame and refuses a pick without asking the server. Story travel and `player.fastTravel` still work. It is on by default, and `player.getFastTravelEnabled()` reads it back.

While it is on, each pick raises `playerFastTravelRequest(player, request)`, and the player's game holds the trip until the server answers. `request.destinationId` is the fast-travel id they picked. Return `false` from the handler, synchronously, to refuse it, and the player stays on their map screen.

```js
// server/main.js
Events.on("playerFastTravelRequest", (player, request) => {
  if (request.destinationId === "FT_HW_RoomOfRequirement" && !hasRoomKey(player)) return false;
});
```

## Loading another map

`player.travelToMap(map, options)` loads any map by its package path. A path names the map's package, such as `"/Game/Levels/Overland/Overland"`, a dungeon such as `"/Game/Environment/Azkaban/Maps/Azkaban_Dungeon"`, or a mod's `"/<ModFolder>/Maps/<MapName>"`. To find a mod map's path, load it in the game and read the `LoadMap` line in the client log. The path's last segment is the `areaId` that `player.location()` reports there.

| Option | Meaning |
| --- | --- |
| `position` | Where to stand the player, in that map's coordinates, as `{ x, y, z }`. |
| `yaw` | The heading to face at `position`, in degrees. |
| `playerStart` | Instead of `position`, a start tag, the way the game's own dungeon exits travel. A PlayerStart with that tag, else a dungeon of that name. On Overland, a dungeon's name lands at that dungeon's entrance. |
| `levels` | Up to 8 more maps to load into the destination. See [Extra levels](#extra-levels). |

Without `position` or `playerStart`, the player lands at the map's own start. Malformed paths and options throw before anything is sent.

The player's game checks the map is installed first and declines it otherwise, so a mod's map only works when the server requires that mod. List it in [Required CurseForge mods](/guides/hosting-a-server/configuration/#required-curseforge-mods).

`playerMapTravelComplete(player, requestId, status, completion)` fires once the player can play in the new map:

| Status | Meaning |
| --- | --- |
| 0 | The player arrived. |
| 1 | A newer request replaced this one. |
| 2 | The player's game could not travel yet. |
| 3 | Declined: the map, or one of `levels`, is not installed on this player's game. |
| 4 | Their game never answered. |
| 5 | The load ended in another map, which `completion.areaId` names. |
| 6 | The player arrived, but one of `levels` did not load. |

`completion` carries the `map` you asked for, the `place` it came from (see below, `null` here), the `areaId` the player settled in and the `destination` they stand at. `areaId` and `destination` are `null` unless the load settled.

```js
// server/main.js
const DIAGON_ALLEY = "/Sil_LondonDungeon/Maps/Sil_LondonDungeon_DungeonMap"; // CurseForge 1520949

function enterDiagonAlley(player) {
  player.travelToMap(DIAGON_ALLEY);
}

// Back out at the alley's Overland entrance, the way walking through its exit does.
function leaveDiagonAlley(player) {
  player.travelToMap("/Game/Levels/Overland/Overland", { playerStart: "Sil_LondonDungeon_DungeonMap" });
}

Events.on("playerMapTravelComplete", (player, requestId, status, completion) => {
  if (status === 3) player.sendChat("This server's Diagon Alley mod is not installed.");
});
```

### Extra levels

Some areas are no single map: the game loads several into one. `levels` lists up to 8 more maps by package path, loaded into the destination before the player is placed, as the map's own always-loaded parts are. They must differ from each other and from the map. The player's game declines the whole trip if one is not installed (status 3), and status 6 means the player arrived without one of them.

Most of the time you do not need `levels`: every dungeon brings its own parts, and `travelToPlace` knows the game's own sets.

## Places the game builds

Some places in the game have no map of their own to load. The game assembles them from several maps, from a story script a multiplayer session never runs. Loaded with `travelToMap` alone, such a place arrives in the dark or with parts missing.

`player.travelToPlace(name)` knows these places: their maps, the parts the game loads with them, and the spawn the game uses there.

| Name | Place |
| --- | --- |
| `intro.gringotts` | The intro's Gringotts, at the lobby doors. |
| `intro.vault` | The trial chamber below the Gringotts vault. As in the game, it is dark and needs Lumos. |
| `intro.cliffside` | The intro's sunlit cliffside and ruins. |

It returns 0 for a name that is no place, matched case-insensitively. Otherwise it is a `travelToMap` to the place's map, so `playerMapTravelComplete` reports it with the same statuses and `completion.place` set to its name.

```js
// server/main.js
Events.on("chatCommand", (player, message, command) => {
  if (command.toLowerCase() !== "gringotts") return;
  player.travelToPlace("intro.gringotts");
});

Events.on("playerMapTravelComplete", (player, requestId, status, completion) => {
  if (completion.place && status !== 0) player.sendChat(`Could not reach ${completion.place} (status ${status}).`);
});
```

Each place is a map of its own. Players there only meet others who went to the same place, and a respawn, on its own or through `player.respawn()`, reloads Overland. To bring a player back, `travelToMap` to Overland with a `position`, or `fastTravel` to a point.

## Where to go next

- [Join and spawn](/guides/players/join-and-spawn/) for spawn points, deaths and respawns.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for how maps and worlds decide who sees whom.
- [Server configuration](/guides/hosting-a-server/configuration/#required-curseforge-mods) for requiring the mods whose maps you load.
