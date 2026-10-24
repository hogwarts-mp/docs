---
title: Avatar preview
description: Show the player their own live figure inside a web page, for a gear pane or a wardrobe, framed into a rect the page reports, with clips to play and a backdrop behind it.
sidebar:
  order: 605
---

An avatar preview shows the player their own character inside your interface, such as the empty half of a gear pane. The figure is live: it wears their current look and plays an idle or the clips you choose. Only that player sees it. Client scripts drive it with the `AvatarPreview` global, and a [web view](/guides/user-interface/web-views/) tells it where to stand.

## How it works

The figure is a copy of the player's character standing in the world a couple of metres in front of the camera, placed and sized so it lands inside a rect on screen. A flat backdrop stands behind it, covering the rect. The page leaves that rect transparent, and the game shows through it.

Each client has one figure. A new preview replaces the last, whichever resource made it, and the emote preview, `LocalPlayer.emotePreview({ show: true })`, takes the figure over.

## Creating a preview

`AvatarPreview.create(options)` starts a preview and returns its id, which the other calls take. It returns 0 when it refuses the options, and `AvatarPreview.state(0).status` then says why. `anchor` is the only option it needs.

This gear pane creates the preview hidden, and shows it once the page reports where its hole is:

```jsx
// client/main.js
const GEAR_URL = "fw://resources/wardrobe/ui/gear.html";
let gearView = -1;
let preview = 0;

function openGear() {
  const view = Web.createView(GEAR_URL, { focus: true });
  gearView = view;
  preview = AvatarPreview.create({
    anchor: { view, rect: { x: 0, y: 0, w: 0, h: 0, visible: false } },
    backdrop: { color: "#1b1712", gradient: "#0d0b08" },
  });
  if (!preview) console.log(`No avatar preview: ${AvatarPreview.state(0).status}`);

  Web.on(view, "gear:hole", (hole) => {
    const rect = { x: hole.x, y: hole.y, w: hole.w, h: hole.h, visible: hole.visible };
    AvatarPreview.update(preview, { anchor: { view, rect } });
  });
  Web.on(view, "gear:close", closeGear);
}

function closeGear() {
  AvatarPreview.destroy(preview);
  Web.destroyView(gearView);
  preview = 0;
  gearView = -1;
}
```

| Option | Meaning |
| --- | --- |
| `anchor` | The rect to frame the figure into. `{ view, rect: { x, y, w, h, visible } }` is in CSS pixels relative to a web view, as its page measures it. `{ screen: { x, y, w, h } }` is in pixels relative to the screen. |
| `camera` | `framing`, how much of the figure fills the rect's height: `"full"` by default, `"body"` or `"head"`. `yaw`, degrees added to the figure facing the camera: -15 by default, a slight turn. |
| `backdrop` | `color`, and `gradient` for a second colour it blends to at the bottom. Colours are `"#rrggbb"` or linear `[r, g, b]` components. `"none"` leaves the backdrop out. `{ color: "#16181e" }` by default. |
| `light` | The figure's own studio lights: `rig` is `"studio"` by default, or `"none"` to leave it to the world's light. `scale` sets their strength, 1 by default. |
| `world` | `scale`, the figure's size from 0.05 to 10, which sets how near the camera it stands: 0.6 by default. `depth`, centimetres from the figure to the backdrop: 40 by default. `margin`, pixels the backdrop runs past the rect: 8 by default. `isolate`: see [Lighting](#lighting). |

`subject` can only be `"self"`, the default. `backend`, `quality`, `camera.fov` and `camera.pitch` belong to another way of drawing the figure that is not built yet, and the preview ignores them. `light.rig: "fieldguide"` lights like `"studio"` for now.

`AvatarPreview.update(id, options)` merges some options into the preview's. When a field is malformed it applies none of them, returns `false`, and `state(id).status` names the field. It also returns `false` once the preview has ended.

### Hiding and ending

`visible: false` in the anchor's rect hides the figure but keeps it ready, so it comes back at once. A preview anchored to a view also hides while that view is off screen.

A preview ends when:

- `AvatarPreview.destroy(id)` removes it, giving back any view settings it held.
- Another `create`, or the emote preview, takes the figure.
- The player loads another map. Create it again once they arrive.
- Its view is destroyed, as it is when your resource stops.

A preview anchored to the screen outlives your resource, so destroy it as your resource stops. Once a preview has ended, `state(id).ok` is `false` and `status` says why.

## The page's half

The page marks the rect with an element it leaves transparent, and tells your script where that element is whenever it changes. `getBoundingClientRect()` reports CSS pixels relative to the view, which is what the anchor takes.

- Nothing opaque may sit behind the hole, the page's own background included.
- Paint the pane around the hole yourself. The hole's own spread shadow does it: `0 0 0 100vmax` in the pane's colour fills everything around the hole, and `overflow: hidden` on the pane stops the fill at its edges.
- Whatever the page paints over the hole, such as a border or a label, covers the figure. Keep a 2 to 4 px opaque frame over the hole's edge: the backdrop runs `world.margin` pixels past it, under the frame.

The page's body holds the pane, with the hole inside it:

```html
<!-- ui/gear.html, which loads gear.css and gear.js -->
<section class="pane">
  <header>Gear <a id="close" href="#">Close</a></header>
  <div id="hole"></div>
</section>
```

```css
/* ui/gear.css */
html, body { margin: 0; height: 100%; background: transparent; color: #eadfc8; }
.pane { position: absolute; top: 10vh; right: 4vw; width: 40vw; height: 80vh; overflow: hidden; isolation: isolate; }
.pane > :not(#hole) { position: relative; z-index: 1; }
#hole { position: absolute; top: 48px; right: 16px; bottom: 16px; width: 55%; box-shadow: inset 0 0 0 3px #5a4a2e, 0 0 0 100vmax #15120e; }
```

The page's script reports the hole when the page loads, when the window resizes, and when your script asks:

```js
// ui/gear.js, running in the page
const hole = document.getElementById("hole");
let sent = "";

function reportHole(force) {
  const box = hole.getBoundingClientRect();
  const json = JSON.stringify({
    x: Math.round(box.left),
    y: Math.round(box.top),
    w: Math.round(box.width),
    h: Math.round(box.height),
    visible: box.width > 0 && box.height > 0,
  });
  if (json === sent && !force) return;
  sent = json;
  callEvent("gear:hole", json);
}

window.addEventListener("resize", () => reportHole(false));
window.addEventListener("gear:refresh", () => reportHole(true));
document.getElementById("close").addEventListener("click", (event) => {
  event.preventDefault();
  callEvent("gear:close", null);
});
reportHole(true);
```

Report again after anything else that moves or resizes the hole, such as a tab that changes the layout; a `ResizeObserver` on the hole catches changes to its size. If your script starts listening after the page has loaded, send the page `gear:refresh` with `Web.emit` for a fresh report.

The game draws the figure a frame or two behind the page, so a hole that moves, such as one in a panel sliding in, leaves the figure trailing. Do not animate the hole: report `visible: false` while it moves, and its place once it settles.

## Clips and framing

The figure starts on a looping idle. `AvatarPreview.play(id, clip, loop)` plays one of the game's animation clips on it by its object path, `/Game/<folder>/<name>.<name>`, looping unless `loop` is `false`. `""` goes back to the idle. Abilities do not play on the figure, only clips.

```js
// client/main.js
const CHEER = "/Game/Animation/Human/Adult/Adult_F/AdF_BM_Idle_Positive_Cheer_v02_anm.AdF_BM_Idle_Positive_Cheer_v02_anm";

function showOff() {
  AvatarPreview.play(preview, CHEER);
  AvatarPreview.update(preview, { camera: { framing: "body" } });
}

function settle() {
  AvatarPreview.play(preview, "");
  AvatarPreview.update(preview, { camera: { framing: "full" } });
}
```

A clip that does not load leaves a note in `status`. `state(id).debug.animating` is `false` while the figure stands in its reference pose instead of playing a clip.

## Matching your page

The figure and the backdrop stand in the world, so the game treats them like the rest of it:

- The backdrop does not match a CSS colour exactly. The game's exposure, tone curve and time-of-day grading apply to it like any other pixel of the world. In daylight a dark colour reads near black, and at night brighter. Frame the hole so the seam does not matter, or pick a family of colours rather than one exact shade.
- The figure is not cut to the rect. Where it reaches past the hole, only the page's opaque parts hide it, so keep it inside with `camera.framing`.
- Anything in the world nearer the camera than the backdrop draws over it. The backdrop stands about 2.5 m from the camera at the default size. A smaller `world.scale` brings the figure and the backdrop nearer, so less gets in front.

## Lighting

The studio lights take the sun's place on the figure, but the sky's light and the game's ambient light still reach it, so it shifts a little with the hour.

`world.isolate: true` takes fog, sky light, ambient light and reflections out of the whole view and fixes its exposure, so the studio lights alone light the figure. Because it changes every pixel of the world, it only takes effect while the rect covers at least 75% of the screen, as a full-screen wardrobe does. Destroying the preview puts the view back.

## Reading a preview

`AvatarPreview.state(id)` reports what a preview is showing now:

| Field | Meaning |
| --- | --- |
| `ok` | Whether the preview is live |
| `ready` | Whether the figure has spawned. It takes a few frames, and needs the player's character in the world. |
| `visible` | Whether the figure is on screen |
| `rect` | Where the anchor is on screen, in pixels; `null` while hidden |
| `backdrop` | Whether the backdrop is up |
| `hold` | `"isolate"` while `world.isolate` is in effect, otherwise `"none"` |
| `status` | The last failure or note, cleared once read |

`backend`, `isolation`, `worldLitMeshes` and `debug` are diagnostics.

## Where to go next

- [Web views](/guides/user-interface/web-views/) for shipping the page and passing messages between it and your script.
- [Keys and menus](/guides/user-interface/keys-and-menus/) for opening the pane from a key and keeping the game's own menus shut.
- [Appearance](/guides/players/appearance/) for the look the figure wears.
