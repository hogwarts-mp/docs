---
title: Walking and seating players
description: Walk a player to a point or after another player from the server, seat them exactly on furniture from a client script, and land a scripted flight without a deadly fall.
sidebar:
  order: 307
---

A server script can walk a player's own character, to a point or after another player. The player's game does the walking with its own on-foot movement, so they and everyone around them see an ordinary walk. Client scripts can also seat the local player exactly on a bench or chair, and fly them without the landing counting as a fall.

To put a player somewhere at once, or in another map, see [Travel between places](/guides/players/travel/).

## Walking to a point

`player.moveTo(x, y, z, options)` walks a player to a point in the map they are in. `z` is the height of the player's origin, as in `player.position`. The options need an `owner`, a tag of your choosing; see [Owners](#owners).

The player's game finds its own way around walls and furniture, and walks until they are within `acceptRadius` of the point and within 3 m of its height. `playerMoveEnded` then fires with `"arrived"`.

```js
// server/main.js
function marchToCell(player) {
  player.moveTo(cell.x, cell.y, cell.z, { owner: "jail:march", acceptRadius: 50, ttlMs: 60000 });
}

Events.on("playerMoveEnded", (player, owner, reason) => {
  if (owner !== "jail:march") return;
  if (reason === "arrived") player.sendChat("Welcome to your cell.");
  else if (reason === "blocked" || reason === "expired") player.teleport(cell.x, cell.y, cell.z);
});
```

`moveTo` returns `false` when the player has no live character.

## Following another player

`player.follow(target, options)` walks a player after another, given as a player or their id. The follower walks until they are within `distanceCm` of the target, waits there, and sets off again once the target is 100 cm further away. A follow never arrives: it runs until you stop it, another walk replaces it, its `ttlMs` runs out or the target is lost.

```js
// server/main.js
// "/escort 12" walks player 12 after the guard who typed it, for up to five minutes.
Events.on("chatCommand", (player, message, command, args) => {
  if (command.toLowerCase() !== "escort" || !isGuard(player)) return;
  const prisoner = PlayerManager.getById(Number(args[0]));
  if (!prisoner || prisoner.id === player.id) return;
  if (!prisoner.follow(player, { owner: "jail:escort", distanceCm: 150, ttlMs: 5 * 60 * 1000 })) {
    player.sendChat("That player cannot walk right now.");
  }
});
```

`follow` returns `false` when either player has no live character, and throws when a player is told to follow themselves.

## Walk options

| Option | Meaning |
| --- | --- |
| `owner` | Required. A tag naming whose walk it is; see [Owners](#owners) |
| `gait` | `"walk"`, the default, at about 156 cm/s, or `"jog"`, at about 450 cm/s |
| `speed` | A pace from 80 to 450 cm/s, instead of `gait` |
| `ttlMs` | Ends the walk with `"expired"` after this many milliseconds. 0, the default, lets it run until it ends by itself |
| `path` | `"nav"`, the default, finds a way on the navmesh and walks straight where there is none; `"direct"` always walks straight |
| `lockInput` | `true` by default: the player's own controls stop while the walk runs. See [Input during a walk](#input-during-a-walk) |
| `acceptRadius` | `moveTo` only. How close counts as arrived, from 10 to 2000 cm: 75 by default |
| `distanceCm` | `follow` only. How close the follower stays, from 50 to 3000 cm: 200 by default |

A missing `owner`, an unknown `gait` or `path`, a negative `ttlMs` or a number out of range throws.

## Owners

A player walks one walk at a time. Starting another, with any owner, ends the running one with `"replaced"`. The `owner` tag says whose walk it is: `playerMoveEnded` hands it back, so each resource can pick out its own walks. Every resource shares the same tags, so start yours with your resource's name.

`player.stopMoving(owner)` stops the player where they stand and ends the walk with `"released"`, but only if that owner started it. It returns `false` when no walk of that owner runs. Without an owner, it ends whichever walk runs.

Nothing ends a walk when the resource that started it stops, so a follow without a `ttlMs` keeps going until something else ends it.

`player.moving()` reads the walk a player is on, or returns `null`:

| Field | Meaning |
| --- | --- |
| `owner` | The tag it was started with |
| `mode` | `"to"` for `moveTo`, `"follow"` for `follow` |
| `x`, `y`, `z` | `moveTo`'s point |
| `targetId` | The id of the player `follow` walks after |
| `gait`, `speed` | The gait asked for, and the speed, or `null` without one |
| `radius` | Its `acceptRadius` or `distanceCm` |
| `expiresAt` | The server clock time, in milliseconds, its `ttlMs` ends it at; 0 without one |

## When a walk ends

`playerMoveEnded(player, owner, reason)` fires when a walk ends, with one of these reasons:

| Reason | Meaning |
| --- | --- |
| `arrived` | A `moveTo` reached its point. The server checks this against where it last saw the player, and reports an arrival it cannot confirm as `blocked` |
| `blocked` | The walk made no headway for 5 seconds: a wall, a locked door, a crowd |
| `targetLost` | A follow's target left the server, or the follower's game has not seen them for 2 seconds, for example because they went to another map |
| `interrupted` | The player mounted, swam, was knocked down or was taken by a scene for more than 3 seconds |
| `travel` | The player was teleported, fast travelled, changed maps or respawned. Calling `player.teleport`, `fastTravel`, `travelToMap` or `travelToPlace` on them ends a walk this way at once |
| `died` | The player died |
| `released` | `stopMoving` ended it |
| `replaced` | Another `moveTo` or `follow` took its place |
| `expired` | Its `ttlMs` ran out |
| `disconnect` | The player left |

The walk runs in the player's own game, as all their movement does, so a modified client can ignore it. To keep a player somewhere whatever their client does, hold them there with `player.hold` once they arrive: their client cannot undo a hold (see [Authority](/guides/core-concepts/authority/#what-the-server-owns)).

## Input during a walk

With `lockInput`, the default, the player's own movement, casting and other controls stop while the walk runs, and come back when it ends. The camera stays theirs to turn. With `lockInput: false` they keep their controls, but the walk still does the steering.

A walk's hold on the player's input sits beside the holds client scripts take with [`LocalPlayer.stopPlayerInput()`](/guides/user-interface/keys-and-menus/#locking-the-controls), and input stays stopped while anything holds it. So the end of a walk never frees a player a client script still holds, and a script's `restorePlayerInput()` returns `false` while a walk still holds them.

## Seating the player

A seated body overlaps its seat, and the other ways of placing a player resolve that overlap: `LocalPlayer.setPosition` and `player.teleport` push them clear of it. `LocalPlayer.anchor(at)` puts the local player exactly on a point and holds them there, with no gravity and nothing pushing them out, while their collision stays on.

`at` is the sit point at floor level, as `x`, `y` and `z`. The height of the body is added for you, so a resized character sits right. `yaw` is the way to face, by default the way they face now, and `camera: true` turns the camera with them. Calling `anchor` again seats them somewhere else. It returns `false` with no character, or while the player is dead, kneeling, riding, held by the server or mid-teleport.

On the game's own benches and chairs, the sit point is in front of the seat and the player faces away from it, because the seated clips carry the body back onto the seat. Anchoring at the middle of the seat puts their legs inside the furniture. The station copies of those meshes, under `/Game/Gameplay/Stations/`, mark the point with an `AnimStart` socket.

Anchoring only places the body. Play a seated pose with `LocalPlayer.playClip`, holding its last frame. Other players see the pose, and the body where it sits, without any server call.

```js
// client/main.js
const BENCH_CLIP = "/Game/Animation/Human/Stations/Sitting/HUF_STN_SIT_Bench_Idle_EatingApple_ANM.HUF_STN_SIT_Bench_Idle_EatingApple_ANM";
let seat = null;

// The server sends a bench's sit point and facing, and a spot clear of the table to stand up at.
Events.on("tavern:sit", (bench) => {
  if (!LocalPlayer.anchor({ x: bench.x, y: bench.y, z: bench.z, yaw: bench.yaw, camera: true })) return;
  LocalPlayer.playClip(BENCH_CLIP, { loop: false, hold: true });
  seat = bench;
});

// Movement keys do nothing while seated, so standing up needs a key of its own.
Key.bind("f3", () => {
  if (seat) LocalPlayer.releaseAnchor(seat.exit);
});

// Whatever ended the seat, the seated pose ends with it.
Events.on("anchorReleased", () => {
  LocalPlayer.stopEmote();
  seat = null;
});
```

`LocalPlayer.releaseAnchor(exit)` stands the player up at `exit`, a floor-level point with an optional `yaw`, placed clear of anything in the way, so a player seated under a table comes out beside it. Without an `exit` they stand up where they are, and the game pushes them out of whatever they overlap, in whatever direction it picks. It returns `false` when the player was not seated.

`LocalPlayer.getAnchor()` returns the point and `yaw` the player is seated at, or `null`. `LocalPlayer.setRotation(yaw, { camera })` turns the player's body, and walking turns it again as usual; while they are seated it turns the seat. It returns `false` with no character or while they ride something.

### When a seat ends

`anchorReleased(reason, at)` fires the frame after a seat ends, with `at`, the floor-level point the player sat at, and one of these reasons:

| Reason | Meaning |
| --- | --- |
| `script` | `releaseAnchor` ended it |
| `death` | The player died |
| `kneel` | The player went down to their knees, as after a PvP defeat |
| `mount` | The player got on a broom or a creature, or took an animal form |
| `teleport` | A teleport, a fast travel or `setPosition` moved them, or something else moved them off the seat |
| `hold` | The server put a hold on them |
| `travel` | A map started loading |
| `pawn` | The player's character was replaced by a new one |

## Landing a scripted flight

A client script can fly the local player itself: `LocalPlayer.setCollision(false)` lets them pass through the world, and `LocalPlayer.setPosition(x, y, z)` moves them a short step at a time. The game only stops counting a fall after a teleport of more than 1 m, so to it a flight of short steps is one long fall. When collision comes back, the landing counts about the height gained since the flight began plus the real drop. Past 16 m that kills the player, even one made invulnerable with `LocalPlayer.stateInfo.setInvulnerableToDamage`.

`LocalPlayer.resetFall()` treats the player as just teleported: the next landing deals no fall damage, and a later fall is measured from where they are now. Call it before turning collision back on. It returns `false` with no character.

```js
// client/main.js
function stopFlying() {
  clearInterval(flightTimer);
  LocalPlayer.resetFall();
  LocalPlayer.setCollision(true);
}
```

## Where to go next

- [Travel between places](/guides/players/travel/) for teleports, fast travel and loading other maps.
- [Keys and menus](/guides/user-interface/keys-and-menus/#locking-the-controls) for stopping a player's input, jumping and sprinting from a client script.
- [Camera](/guides/camera-and-sound/camera/) for taking over the view while a walk or a seat plays out.
