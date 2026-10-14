---
title: Objects and effects
description: Place props from the game's meshes and visual effects from its effect systems, keyed so you can replace or remove them later.
sidebar:
  order: 510
---

The server can place two kinds of decoration that every nearby player sees: world objects, built from the game's static meshes, and effects, built from its particle systems. Both are created under a key of your choosing: creating again with the same key replaces the old one, and the key removes it later.

## World objects

```js
// server/main.js
WorldObject.create("market-barrel-1", "/Game/Environment/BanditCamps/Interactables/SM_Int_BCProps_Barrel_001_W.SM_Int_BCProps_Barrel_001_W", {
  x, y, z,
  yaw: 45,
  promptText: "[F] Search the barrel",
});
```

`WorldObject.create(key, model, options)` takes the model as a static-mesh asset path, `/Game/<folder>/<Mesh>.<Mesh>`, or as a numeric id from the Mod's catalog of world-object meshes, and throws for anything else. It returns the object, or `undefined` if it could not be created.

| Option | Meaning |
| --- | --- |
| `x`, `y`, `z` | Its position, in world centimetres |
| `pitch`, `yaw`, `roll` | Its rotation, in degrees |
| `scale` | Its size; 1 is native |
| `collision` | Whether it has collision: `true` by default |
| `promptText` | A floating line, seen only within `promptRange`, usually inviting players to interact |
| `promptHeight` | Where the prompt floats, in centimetres above the object's origin: 150 by default |
| `promptRange` | How close a player must be to see the prompt, in centimetres: 250 by default |

The prompt is only text; handling the interaction it invites is up to your resource. `WorldObject.destroy(key)` removes an object by its key, `object.destroy()` removes one through its handle, and `WorldObjectManager.getAll()` lists every live object. `object.modelPath` reads back the mesh it shows, whichever form you created it with.

## Effects

```js
// server/main.js
const campfire = "/Game/VFX/Niagara/Basic/Fire/TorchFires/VFX_NS_Fire_Uni_Campfire_Low.VFX_NS_Fire_Uni_Campfire_Low";

Fx.create("camp-fire", campfire, { x, y, z });
Fx.create("spawn-flash", flashPath, { x, y, z, scale: 2, ttl: 5 });
```

`Fx.create(key, path, options)` takes a Niagara or Cascade system asset path and throws for a malformed one. Its options are a position, a rotation in degrees (`pitch`, `yaw`, `roll`), a `scale` and a `ttl`: the number of seconds before the server removes the effect on its own. Without a `ttl`, an effect lasts until you remove it with `Fx.destroy(key)` or `effect.destroy()`.

`Fx.catalog()` lists effects known to work, each with a category such as fire, explosions, smoke, weather, water, ambient or magic, a name and its path. It is a starting point rather than a limit: any well-formed effect path spawns. `FxManager.getAll()` lists every live effect.

## Lifetime

Objects and effects your resource creates are destroyed when it stops, along with its other entities. They are not saved: a resource that keeps placed props across restarts stores their keys, models and positions itself and creates them again when it starts.

Like other entities they start in [virtual world](/guides/core-concepts/virtual-worlds/#placing-entities) 0; call `setVirtualWorld` on one to show it to players in another world.

## Where to go next

- [Loot](/guides/world/loot/) for chests, moonstone deposits and foragables players can take items from.
- [Doors](/guides/world/doors/) for locking and opening the game's own doors.
