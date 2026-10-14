---
title: Objects and effects
description: Place props from the game's meshes and Blueprints, move them, and add visual effects that stay put or follow an entity, keyed so you can replace or remove them later.
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

`WorldObject.create(key, model, options)` takes the model as a mesh's asset path, `/Game/<folder>/<Mesh>.<Mesh>`, a Blueprint's class path, `/Game/<folder>/BP_Name.BP_Name_C`, or a numeric id from the Mod's catalog of world-object meshes, and throws for anything else. It returns the object, or `undefined` if it could not be created.

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

The prompt is only text; handling the interaction it invites is up to your resource. `WorldObject.destroy(key)` removes an object by its key, `object.destroy()` removes one through its handle, and `WorldObjectManager.getAll()` lists every live object. `object.modelPath` reads back the model it shows, whichever form you created it with.

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

A Blueprint object runs the game's own logic for that Blueprint. Placed normally, every player's game runs its own copy, so anything that moves by itself moves differently for each player. With `simulated: true`, the game of the nearest player runs it and everyone else follows. The game's race ring, `/Game/Gameplay/BroomRaces/Blueprints/BP_RaceRing.BP_RaceRing_C`, and loose snitch, `/Game/Levels/WorldEvents/Blueprints/LooseSnitch/BP_Loose_Snitch.BP_Loose_Snitch_C`, are known to work; [Quidditch](/guides/quidditch/running-a-match/) builds a match from them. Other Blueprints spawn, but may not behave.

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
  torch.setVirtualWorld(player.virtualWorld);
  torch.attachTo(player, { x: 30, y: 25, z: 70 });
  return torch;
}
```

An attached effect does not take its entity's virtual world, so set it to match.

`effect.setColor(name, color)` sets one of a Niagara effect's colour parameters, by the parameter's name, for everyone. Components run from 0 to 1, and values above 1 glow. An effect can carry up to four colours, and Cascade effects ignore them.

## Lifetime

Objects and effects your resource creates are destroyed when it stops, along with its other entities. They are not saved: a resource that keeps placed props across restarts stores their keys, models and positions itself and creates them again when it starts.

Like other entities they start in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0; call `setVirtualWorld` on one to show it to players in another world.

## Where to go next

- [Loot](/guides/world/loot/) for chests, moonstone deposits and foragables players can take items from.
- [Doors](/guides/world/doors/) for locking and opening the game's own doors.
