---
title: Post-processing
description: Grade a player's view with post-process layers, from a photo-mode filter or settings of your own to full-screen materials, and blend them in and out.
sidebar:
  order: 705
---

A post-process layer grades what one player sees: its colour, contrast, bloom, vignette, grain and the rest of Unreal's post-process settings, or a full-screen material. Client scripts set layers on the `Camera` global, by a key of your own. A layer applies to whichever camera the player sees through, the game's own or a [custom camera](/guides/camera-and-sound/camera/), and it draws over the game's own grading, the time-of-day look included.

```js
// client/main.js
Camera.setPostProcess("dusk", {
  settings: { ColorSaturation: 0.6, SceneColorTint: { r: 1, g: 0.85, b: 0.7 }, VignetteIntensity: 0.8 },
  fade: 2,
});
```

Setting a key again replaces that layer. Each layer belongs to the resource that set it and goes when the resource stops, and it comes back by itself after the player travels to another map.

## Starting from a preset

`preset` starts a layer from one of the game's photo-mode filters. `Camera.postProcessPresets()` lists their names: `Ashwinder`, `Canvas`, `DailyProphet`, `DeathlyHallows`, `Glacius`, `Gryffindor`, `Hufflepuff`, `Merlin`, `Mirror`, `Portrait`, `Ravenclaw` and `Slytherin`. The name is not case-sensitive.

```js
// client/main.js
Key.bind("f7", () => {
  if (Camera.getPostProcess("house")) Camera.removePostProcess("house", 1);
  else Camera.setPostProcess("house", { preset: "Ravenclaw", weight: 0.8, fade: 1 });
});
```

`Canvas`, `DeathlyHallows` and `Portrait` also bring a full-screen material, such as Canvas's halftone print; the others are settings only. A preset can also be the object path of an asset that holds post-process settings.

## Settings

`settings` sets post-process settings by their Unreal name, such as `BloomIntensity` or `AutoExposureBias`; a lower-case first letter works too. `Camera.postProcessSettings()` lists every name a layer can set. A layer changes only the settings it names, plus whatever its preset sets, and those you give go over the preset's.

| Type | Value | Example |
| --- | --- | --- |
| Number | a number | `VignetteIntensity: 0.9` |
| Switch | `true` or `false` | `AmbientOcclusionRadiusInWS: true` |
| Choice | the choice's number | `AutoExposureMethod: 2` |
| Colour | `{ r, g, b, a }`, each from 0 | `SceneColorTint: { r: 1, g: 0.5, b: 0.5 }` |
| Grading (`ColorSaturation`, `ColorGain`, …) | `{ x, y, z, w }`, red, green, blue and overall, or a number for the overall amount | `ColorSaturation: 0` |
| Texture or curve | an object path, or `""` for none | `ColorGradingLUT: "/Game/MyLuts/T_Lut.T_Lut"` |

Parts you leave out of a colour or a grading value keep the preset's value, or the game's default. A name the game doesn't have, or a value of the wrong type, throws a `TypeError`, and nothing changes.

## Materials

`materials` adds post-process materials to a layer: a list of object paths, or of `{ path, weight }` with a `weight` from 0 to 1. Each must be a material whose domain is Post Process, and a layer takes up to 16:

```js
// client/main.js
Camera.setPostProcess("newspaper", {
  materials: ["/DirectorCam/PhotoMode/Filters/PM_Filter_Canvas/M_Filter_Canvas.M_Filter_Canvas"],
});
```

Many of the game's own effect materials draw nothing on their own, because the game drives their parameters while the effect plays. A material or texture that does not load is logged on the client, and the rest of the layer still applies.

## Weight, order and fades

- `weight`, from 0 to 1 (1 by default), is how much of the layer shows. At 0.5 every setting sits halfway between the game's look and yours.
- `priority`, from -100 to 100 (0 by default), orders layers: a higher one draws over a lower one where both set the same thing.
- `fade` is how many seconds the layer takes to blend from its current weight to the new one. It applies to that call only, and a new layer fades in from nothing.

`Camera.removePostProcess(key, fade)` blends a layer out over `fade` seconds (none by default) before removing it. A key that is fading out is already gone from `postProcessKeys()`, and setting it again brings it back from where it is.

## Changing a layer

`Camera.updatePostProcess(key, changes)` changes only the fields you pass. Its `settings` merge one by one, and `null` drops one; `materials` replaces the whole list. It returns `false` when no layer has the key.

```js
// client/main.js
Camera.updatePostProcess("dusk", { settings: { VignetteIntensity: null, GrainIntensity: 0.4 } });
Camera.updatePostProcess("dusk", { weight: 0.3, fade: 5 });
```

`Camera.getPostProcess(key)` returns a layer as it stands, with each setting under its exact name, or `null`. `Camera.postProcessKeys()` lists your resource's keys, and `Camera.removeAllPostProcess()` removes all of its layers at once. A client holds at most 64 layers across every resource; past that `setPostProcess` throws an `Error`.

## From the server

Layers live on the client, so a server that wants one sends an event, and a client script sets it. Here a PvP hit greys its victim's view for a moment:

```js
// server/main.js
Events.on("pvpHit", (casterId, victimId) => {
  PlayerManager.getById(victimId)?.emit("look:hurt", JSON.stringify({ seconds: 1.5 }));
});
```

```js
// client/main.js
Events.on("look:hurt", (payload) => {
  Camera.setPostProcess("hurt", {
    settings: { ColorSaturation: 0.2, VignetteIntensity: 1.2, SceneColorTint: { r: 1, g: 0.6, b: 0.6 } },
    fade: 0.2,
  });
  setTimeout(() => Camera.removePostProcess("hurt", payload.seconds), 200);
});
```

## Where to go next

- [Camera](/guides/camera-and-sound/camera/) for cutscenes, paths and fades to go with a grade.
- [Events](/guides/core-concepts/events/) for sending a client what to show.
- [Hits and defeat](/guides/pvp/hits-and-defeat/) for the `pvpHit` event.
