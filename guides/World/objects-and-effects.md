---
title: Objects and effects
description: Place props from the game's meshes and Blueprints, move, animate and time them, and add visual effects that stay put or follow an entity, keyed so you can replace or remove them later.
sidebar:
  order: 510
---

The server can place two kinds of thing that every nearby player sees: world objects, built from the game's meshes and Blueprints, and effects, built from its particle systems. Both are created under a key of your choosing: creating again with the same key replaces the old one, and the key removes it later. Keys are shared by every resource, so start yours with your resource's name.

## World objects

```js
// server/main.js
WorldObject.create("market-barrel-1", "/Game/Environment/BanditCamps/Interactables/SM_Int_BCProps_Barrel_001_W.SM_Int_BCProps_Barrel_001_W", {
  x, y, z,
  yaw: 45,
  promptText: "[F] Search the barrel",
});
```

`WorldObject.create(key, model, options)` takes the model as a static or skeletal mesh's asset path, `/Game/<folder>/<Mesh>.<Mesh>`, a Blueprint's class path, `/Game/<folder>/BP_Name.BP_Name_C`, or a numeric id from the Mod's catalog of world-object meshes, and throws for anything else. It returns the object, or `undefined` if it could not be created.

| Option | Meaning |
| --- | --- |
| `x`, `y`, `z` | Its position, in world centimetres |
| `pitch`, `yaw`, `roll` | Its rotation, in degrees |
| `scale` | Its size; 1 is native |
| `collision` | Whether it has collision: `true` by default |
| `promptText` | A floating line, seen only within `promptRange`, usually inviting players to interact |
| `promptHeight` | Where the prompt floats, in centimetres above the object's origin: 150 by default |
| `promptRange` | How close a player must be to see the prompt, in centimetres: 250 by default |
| `fx`, `fxSocket` | An effect's path to attach to the object as it spawns, and the socket on its mesh to attach it to |
| `physics`, `massKg` | Makes a mesh object a [physics object](/guides/world/physics-objects/) that falls, rolls and can be thrown, and its mass |
| `simulated` | For a Blueprint, lets one player's game run it for everyone; see [Blueprint objects](#blueprint-objects) |
| `streamRange` | How close a player must be to receive the object, in centimetres: 50000 (500 m) by default, from 100 to 200000 |
| `drawDistance` | How far away players who have the object still draw it, in centimetres; 0 draws it at any distance. Without it, a mesh is drawn at any distance and a Blueprint keeps the game's own distances |
| `animation`, `material` | Its [look](#animation-and-material) |
| `motion` | Sends it off [by itself](#objects-that-move-by-themselves) |
| `ttl`, `startFx`, `endFx`, `shrinkOut` | Its [lifetime](#timed-objects) |

The prompt is only text; handling the interaction it invites is up to your resource. `WorldObject.destroy(key)` removes an object by its key, `object.destroy()` removes one through its handle, and `WorldObjectManager.getAll()` lists every live object. `object.modelPath` reads back the model it shows, whichever form you created it with.

`object.streamRange` and `object.drawDistance` change those two later, and a negative `drawDistance` goes back to the default. Lower `streamRange` for small props nobody notices from afar, so distant players are not sent them, and raise it for a landmark.

### Moving objects

Set `object.position` to move an object. It glides to the new place on every player's screen:

```js
// server/main.js
const lift = WorldObject.create("tower-lift", "/Game/Environment/BanditCamps/Interactables/SM_Int_BCProps_Barrel_001_W.SM_Int_BCProps_Barrel_001_W", { x: 0, y: 0, z: 0 });
let up = false;
setInterval(() => {
  up = !up;
  if (lift) lift.position = new Vector3(0, 0, up ? 800 : 0);
}, 5000);
```

### Blueprint objects

A Blueprint object runs the game's own logic for that Blueprint. Placed normally, every player's game runs its own copy, so anything that moves by itself moves differently for each player. With `simulated: true`, the game of the nearest player runs it and everyone else follows, and it changes hands the way a [physics object](/guides/world/physics-objects/#who-simulates-it) does. The game's race ring, `/Game/Gameplay/BroomRaces/Blueprints/BP_RaceRing.BP_RaceRing_C`, and loose snitch, `/Game/Levels/WorldEvents/Blueprints/LooseSnitch/BP_Loose_Snitch.BP_Loose_Snitch_C`, are known to work; [Quidditch](/guides/quidditch/running-a-match/) builds a match from them. Other Blueprints spawn, but may not behave.

### Animation and material

`animation` loops an animation on a skeletal mesh, such as one of the game's creatures. It has to be made for that mesh's skeleton: one made for another skeleton does not play. `material` puts one material on every slot of the mesh; without it, the mesh keeps its own. Both are asset paths, `/Game/<folder>/<Name>.<Name>`, and both apply only to meshes: a Blueprint keeps its own look.

### Timed objects

`ttl` has the server destroy the object after that many seconds, up to 3600, as it does an effect. `shrinkOut` shrinks it away over its last seconds, and can be no longer than the `ttl`. `startFx` is an effect each player's game plays where the object appears, for players who receive it within half a second of its creation. `endFx` is one played where each player's copy is when the time runs out; destroying the object before then plays none.

### Objects that move by themselves

`motion: { speed, heading, followGround }` sends an object off in a straight line from where it was created, at `speed` centimetres a second along `heading`, a world yaw in degrees that defaults to the object's `yaw`. With `followGround`, it keeps to the ground beneath it instead of its starting height. It does not turn, so it faces its `yaw` all the way. The game's creature meshes are turned 90 degrees from their yaw, so create one with `yaw: heading - 90` to have it run head first.

Each player's game runs the motion itself, so nothing is sent while the object moves, and a player who comes into range mid-run sees it where everyone else does. The server's `object.position` stays at the starting point, so a [zone](/guides/encounters/zones/) sees the object there too. It keeps going until its `ttl` runs out, and setting `object.position` or `object.rotation` ends the run and leaves it where you put it. `create` throws for `motion` together with `physics` or `simulated`.

This summons a glowing stag that gallops off the way a player faces, then vanishes:

```js
// server/main.js
const STAG = "/Game/RiggedObjects/Characters/Creatures/Stag/SK_DeerStag.SK_DeerStag";
const GALLOP = "/Game/Animation/Creatures/Deer/Deer_BM_Gallop_anm.Deer_BM_Gallop_anm";
const GLOW = "/Game/VFX/MasterMaterials/MaterialInstance/VFX_MI_CIN_Glow_Patronus.VFX_MI_CIN_Glow_Patronus";
const PUFF = "/Game/VFX/UI/Patronus/VFX_NS_Patronus_Spawn.VFX_NS_Patronus_Spawn";
let summons = 0;

Events.on("chatCommand", (player, message, command) => {
  if (command.toLowerCase() !== "patronus") return;
  const heading = player.location()?.yaw ?? 0;
  const { x, y, z } = player.position;
  const stag = WorldObject.create(`patronus:${++summons}`, STAG, {
    x, y, z,
    yaw: heading - 90,
    collision: false,
    animation: GALLOP,
    material: GLOW,
    motion: { speed: 900, heading, followGround: true },
    ttl: 3,
    shrinkOut: 0.4,
    startFx: PUFF,
    endFx: PUFF,
  });
  stag?.setVirtualWorld(player.virtualWorld, player.location()?.areaId);
});
```

## Effects

```js
// server/main.js
const campfire = "/Game/VFX/Niagara/Basic/Fire/TorchFires/VFX_NS_Fire_Uni_Campfire_Low.VFX_NS_Fire_Uni_Campfire_Low";

Fx.create("camp-fire", campfire, { x, y, z });
Fx.create("spawn-flash", flashPath, { x, y, z, scale: 2, ttl: 5 });
```

`Fx.create(key, path, options)` takes a Niagara or Cascade system asset path and throws for a malformed one. Its options are a position, a rotation in degrees (`pitch`, `yaw`, `roll`), a `scale` and a `ttl`: the number of seconds before the server removes the effect on its own. Without a `ttl`, an effect lasts until you remove it with `Fx.destroy(key)` or `effect.destroy()`.

`Fx.catalog()` lists effects known to work, each with a category such as fire, explosions, smoke, weather, water, ambient or magic, a name and its path. It is a starting point rather than a limit: any well-formed effect path spawns. `FxManager.getAll()` lists every live effect.

### Attaching effects

`effect.attachTo(entity, offset)` makes an effect follow a player, NPC, beast, world object or character, turning with it, at an `offset` in centimetres from its centre. It is destroyed with the entity, for example when a player leaves. `effect.detach()` leaves it where it is, and `effect.attachedTo` is the entity's id, or 0.

```js
// server/main.js
function lightTorch(player) {
  const torch = Fx.create(`torch:${player.id}`, campfire, { scale: 0.3 });
  if (!torch) return undefined;
  torch.setVirtualWorld(player.virtualWorld, player.location()?.areaId);
  torch.attachTo(player, { x: 30, y: 25, z: 70 });
  return torch;
}
```

An attached effect does not take its entity's virtual world or map, so set them to match.

`effect.setColor(name, color)` sets one of a Niagara effect's colour parameters, by the parameter's name, for everyone. Components run from 0 to 1, and values above 1 glow. An effect can carry up to four colours, and Cascade effects ignore them.

## Lifetime

Objects and effects your resource creates are destroyed when it stops, along with its other entities. They are not saved: a resource that keeps placed props across restarts stores their keys, models and positions itself and creates them again when it starts.

Like other entities they start in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0 of Overland; call `setVirtualWorld(world, map)` on one to show it to players in another world or map.

## Where to go next

- [Loot](/guides/world/loot/) for chests, moonstone deposits and foragables players can take items from.
- [Doors](/guides/world/doors/) for locking and opening the game's own doors.
