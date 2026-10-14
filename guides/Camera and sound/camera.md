---
title: Camera
description: Take over the player's view with a camera of your own, move it in shots, paths and orbits, fade the screen, and hand the view back.
sidebar:
  order: 700
---

Each client has one custom camera that client scripts drive with the `Camera` global. While it is active, the player sees through it instead of the game's own camera, and `Camera.restore()` hands the view back. Positions are world centimetres, rotations are degrees and durations are seconds.

The camera only changes what the player sees. Their character still answers their input, so stop it with `LocalPlayer.stopPlayerInput()` for a cutscene, and hand it back with `LocalPlayer.restorePlayerInput()`.

## Taking over the view

`Camera.capture()` returns the game camera's current view, as a position, a rotation and a lens, or `null` in a menu or behind a loading screen. `Camera.activate(view, transition)` switches to a fixed camera at a view, blending over half a second by default:

```js
// client/main.js
function showVault() {
  Camera.clearLookAt();
  Camera.activate(
    { position: { x: 15200, y: -3400, z: 900 }, rotation: { pitch: -20, yaw: 90, roll: 0 } },
    { duration: 1.5, curve: "easeInOut" },
  );
}

function endShot() {
  if (Camera.active) Camera.restore({ duration: 1 });
}
```

A transition takes a `duration`, and a `curve` of `"linear"`, `"cubic"`, `"easeIn"`, `"easeOut"`, `"easeInOut"` (the default) or `"preBlended"`. `Camera.restore(transition)` blends back to the player's own camera the same way.

### One camera for every resource

The custom camera belongs to the client, not to the resource that activated it. Every resource drives the same one, and stopping a resource does not give the view back, so restore it yourself as your resource stops:

```js
// client/main.js
Events.on("resourceStop", (resourceName) => {
  if (resourceName === "intro-cutscene" && Camera.active) Camera.restore({ duration: 0 });
});
```

Check `Camera.active` before restoring. `restore` always points the view back at the player's character, so calling it while your camera is not active takes the view from whatever else has it, such as the character creator.

Hand the view back before the player respawns or travels to another map, and activate again afterwards if you still need the camera.

## Moving the camera

Moves, paths, orbits and `lookAt` need an active camera and return `false` without one:

| Call | Does |
| --- | --- |
| `Camera.setPose({ position, rotation })` | Moves the camera at once |
| `Camera.animateTo(view, { duration, easing })` | Moves it to a view over `duration` seconds, 1 by default |
| `Camera.playPath(keyframes, { loop, pingPong })` | Flies it through up to 256 keyframes |
| `Camera.orbit(target, { radius, height, speed })` | Circles it around a point |
| `Camera.lookAt(target, track)` | Aims it at a point, and with `track` keeps aiming while it moves |

`easing` is `"linear"`, `"smoothStep"`, `"easeIn"`, `"easeOut"` or `"easeInOut"`, the default. `Camera.pause()`, `Camera.resume()` and `Camera.stop()` control whatever is moving, and `stop` leaves the camera where it is.

Nothing fires when a move ends. `Camera.playing` stays true while a move, path or orbit runs, so check it on a timer.

### Paths

A path starts at its first keyframe at once. Every later keyframe sets how long the camera takes to reach it, with `duration` (1 second by default) and `easing`. A keyframe without a `lens` keeps the previous one's. This intro flies over the grounds with the player held still, then hands back control:

```js
// client/main.js
const start = { position: { x: 0, y: 0, z: 800 }, rotation: { pitch: -10, yaw: 0, roll: 0 } };

function playIntro() {
  LocalPlayer.stopPlayerInput();
  Camera.clearLookAt();
  Camera.activate(start, { duration: 0 });
  Camera.playPath([
    start,
    { position: { x: 3000, y: 0, z: 900 }, rotation: { pitch: -15, yaw: 30, roll: 0 }, duration: 6 },
    { position: { x: 3000, y: 2500, z: 1200 }, rotation: { pitch: -25, yaw: 90, roll: 0 }, duration: 5, easing: "easeOut" },
  ]);

  const timer = setInterval(() => {
    if (Camera.playing) return;
    clearInterval(timer);
    Camera.restore({ duration: 1 });
    LocalPlayer.restorePlayerInput();
  }, 250);
}
```

`loop` repeats the path until you stop it, and `pingPong` plays it back and forth, for a menu backdrop that keeps moving.

### Orbits

`Camera.orbit(target, options)` circles a point at `radius` centimetres (300 by default), `height` centimetres above it (0 by default) and `speed` degrees per second (20 by default; negative goes the other way). It keeps the camera aimed at the point.

An orbit starts from wherever the camera is around the point and jumps straight onto the circle, so activate the camera on the circle first:

```js
// client/main.js
function circlePlayer() {
  const pos = LocalPlayer.getPosition();
  const view = Camera.capture();
  if (!pos || !view) return;

  Camera.clearLookAt();
  Camera.activate({ position: { x: pos.x + 400, y: pos.y, z: pos.z + 150 }, rotation: view.rotation }, { duration: 1 });
  Camera.orbit(pos, { radius: 400, height: 150, speed: 15 });
}
```

### Clearing the aim

An orbit, or `lookAt`, leaves the camera aimed at its point after the orbit stops, after `stop` and even after `restore`. The aim then overrides the rotation of every later shot until `Camera.clearLookAt()` lifts it, so clear it before you set up a new shot, as the samples above do.

## Lens

`Camera.setLens(options)` changes the active camera's lens: `fov` is the horizontal field of view in degrees, between 0 and 180, and `focalLength`, `aperture` and `postProcessBlend` are there for cinematic shots. A view passed to `activate` or `animateTo`, or a keyframe, can carry a `lens` too. `Camera.lens` reads the lens back.

```js
// client/main.js
Camera.setLens({ fov: 30 });
```

## Fades

`Camera.fade(options)` fades the screen to a colour, whether or not your camera is active. It goes from opacity `from` (0 by default) to `to` (1 by default) over `duration` seconds (1 by default), in black unless you give a `color` with components from 0 to 1.

When a fade finishes, the screen clears again unless you pass `hold: true`. Fade out with `hold`, do what you need behind the curtain, then fade back in:

```js
// client/main.js
function cutTo(view) {
  Camera.fade({ to: 1, duration: 0.5, hold: true });
  setTimeout(() => {
    Camera.clearLookAt();
    Camera.activate(view, { duration: 0 });
    Camera.fade({ from: 1, to: 0, duration: 0.5 });
  }, 500);
}
```

`Camera.stopFade()` clears a fade at once. `restore` does not, so stop a held fade yourself.

## Shakes and other effects

`Camera.playShake(classPath, { scale, space })` plays one of the game's camera shakes by its full class path, and `Camera.stopShakes()` stops them. `Camera.playAnimation`, `Camera.addLensEffect` and `Camera.addModifier` do the same for the game's camera animations, lens effects and modifiers. A modifier cannot be removed again.

## Where to go next

- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/#hiding-the-hud) for hiding the HUD during a cutscene.
- [Audio](/guides/camera-and-sound/audio/) for the sound that goes with it.
