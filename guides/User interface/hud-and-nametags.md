---
title: HUD, prompts and nametags
description: Hide parts of the game's HUD, float an interaction prompt over the world, and set the names, colours and lines over players' heads.
sidebar:
  order: 610
---

Some of what players see on screen is the game's own HUD, which client scripts can hide in parts and add a prompt to. The names over players' heads are set from both sides: the server decides what everyone sees, and each client can add lines and hide nametags for its own player.

## Hiding the HUD

The game sorts its HUD into named groups. `Hud.groups()` lists them, read from the game itself, and `Hud.hideGroup(group)` hides one until `Hud.showGroup(group)` lets it go:

```js
// client/main.js
function startCutscene() {
  for (const group of Hud.groups()) Hud.hideGroup(group);
}

function endCutscene() {
  for (const group of Hud.groups()) Hud.showGroup(group);
}
```

The game also hides groups of its own, and a group stays hidden while either side hides it. The player's own HUD settings are left alone, so there is nothing to put back afterwards.

A hidden group is held by the mod, not by your resource: `showGroup` from any resource releases it, and stopping your resource does not, so show what you hid yourself. Every group comes back when the player disconnects.

`Hud.setVisible(false)` hides the whole HUD with one switch for the whole client. Any resource can turn it back on, and it is not restored on disconnect, so prefer groups. `Settings.setHud` changes the player's own HUD settings and belongs only behind a settings panel they opened.

## Interaction prompts

`Hud.showPrompt(key, label, x, y, z)` floats a `[key] label` prompt at a world position, in centimetres. It follows that point on screen and hides while the point is off screen. There is one prompt per client, so showing another replaces it, and `Hud.hidePrompt()` takes it away.

The prompt only shows text. Pair it with a [key binding](/guides/user-interface/keys-and-menus/#binding-keys), and use `Key.getLabel` so the key it names matches the player's keyboard layout:

```js
// client/main.js
const counter = { x: 12000, y: -4500, z: 300 };
let atCounter = false;

setInterval(() => {
  const pos = LocalPlayer.getPosition();
  const near = !!pos && Math.hypot(pos.x - counter.x, pos.y - counter.y, pos.z - counter.z) <= 250;
  if (near && !atCounter) Hud.showPrompt(Key.getLabel("f"), "Browse wands", counter.x, counter.y, counter.z + 100);
  if (!near && atCounter) Hud.hidePrompt();
  atCounter = near;
}, 200);

Key.bind("f", () => {
  if (atCounter) Events.emitServer("shop:open", { shop: "wands" });
});
```

The server receives `shop:open` as a request from the client, so check there that the player really stands at the counter before opening anything. [Authority](/guides/core-concepts/authority/) covers handling what a client sends.

## Nametags

Every player has a nametag: their name over their head, with a health bar under it. The server sets what everyone sees on a player's nametag:

| Call | Does |
| --- | --- |
| `player.setNametagText(text)` | Shows `text` instead of the player's name, cut to 64 bytes. Empty or no text restores the name. |
| `player.setNametagColor(color)` | Tints the text, as a packed `0xAARRGGBB` number. |
| `player.setNametagVisible(visible)` | Shows or hides the player's nametag for every other player. |
| `player.setNametagHealthVisible(visible)` | Shows or hides only the health bar under it. |

`getNametagText()`, `getNametagColor()`, `isNametagVisible()` and `isNametagHealthVisible()` read them back.

```js
// server/main.js
const STAFF_GOLD = 0xffd4af37; // alpha first, then red, green, blue

function markStaff(player) {
  player.setNametagText(`[Staff] ${player.nickname}`);
  player.setNametagColor(STAFF_GOLD);
}
```

The nametag colour puts alpha first, while chat colours put it last as `0xRRGGBBAA`.

### On the client

Each client can change what its own player sees, without affecting anyone else:

- `Nametags.setVisible(false)` hides every nametag. A nametag the server hid stays hidden either way.
- `Nametags.setHealthVisible(false)` hides the health bars and keeps the names.
- `Nametags.setSelfVisible(true)` draws the player's own nametag, as others see it. It is off by default.

`Nametags.setLabel(entityId, text, durationMs, color)` hangs a passing line above a player's name, for speech, an emote or a status. It follows them and fades and hides with the name. It lasts 6 seconds by default, a duration of 0 or less holds it until cleared, and `\n` starts a new line. `color` is a packed `0xAARRGGBB` number; leave it out for the nametag's own colour. Labels are local: the server sends the event, and each client draws it:

```js
// server/main.js
Events.on("chatCommand", (player, message, command, args) => {
  if (command.toLowerCase() !== "me" || args.length === 0) return;
  Events.emitAllClients("emote", { playerId: player.id, text: `*${args.join(" ")}*` });
});
```

```js
// client/main.js
Events.on("emote", (payload) => {
  Nametags.setLabel(payload.playerId, payload.text, 5000);
});
```

`Nametags.clearLabel(entityId)` removes a label early, and `Nametags.clearLabels()` removes all of them.

## Notices

`Game.notify(text)` shows a line in the local chat, seen only by this player. From the server, [`player.sendChat`](/guides/players/chat-and-commands/#sending-chat) does the same for one player.

## Where to go next

- [Keys and menus](/guides/user-interface/keys-and-menus/) for key bindings and the game's own menus.
- [Web views](/guides/user-interface/web-views/) for drawing interfaces of your own in HTML.
