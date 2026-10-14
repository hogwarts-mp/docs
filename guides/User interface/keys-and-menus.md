---
title: Keys and menus
description: Bind keyboard and mouse keys, lock the game's controls while players use your interface, and keep the game's own menus closed so your resource can replace them.
sidebar:
  order: 630
---

Client scripts can listen for keys of their own, take the game's controls away while players use an interface, and keep the game's own menus from opening so the keys behind them can open yours.

## Binding keys

`Key.bind(key, handler)` runs `handler` when a key is pressed. Pass `"up"` or `"both"` before the handler to run it when the key is released, or on both:

```js
// client/main.js
Key.bind("f2", () => Events.emitServer("menu:open"));

Key.bind("lshift", "both", (key, state) => {
  Events.emitServer("sprint", { held: state === "down" });
});
```

The handler receives the key's name and `"down"` or `"up"`. A key name stands for a key's position, named as on a US keyboard, so `y` is the same physical key on every layout. Names ignore case:

| Keys | Names |
| --- | --- |
| Letters and digits | `a` to `z`, `0` to `9` |
| Function keys | `f1` to `f12` |
| Number pad | `numpad0` to `numpad9`, or `num0` to `num9` |
| Modifiers | `shift`, `lshift`, `rshift`, `ctrl` or `control`, `lctrl`, `rctrl`, `alt`, `lalt`, `ralt` |
| Arrows | `up`, `down`, `left`, `right` |
| Others | `space`, `enter` or `return`, `escape` or `esc`, `tab`, `backspace`, `capslock`, `insert`, `delete`, `home`, `end`, `pageup`, `pagedown` |
| Mouse buttons | `mouse1` to `mouse5` |

An unknown name throws. A key pressed while Alt is held does not fire, so Alt+Tab never reaches your handlers. Bindings fire only while the player is in the game and nothing else has their input: not while the game is in the background or loading, while the chat is open, while a [web view](/guides/user-interface/web-views/) has focus, or while the controls are [locked](#locking-the-controls). A binding does not take the key from the game, which still acts on it, so pick keys the game leaves free.

A binding belongs to the resource that made it and goes when that resource stops. `Key.unbind(key, state, handler)` removes your bindings for a key, all of them when you leave out the state and handler.

`Key.isDown(key)` reads whether a key is held, behind the same checks. `Key.getLabel(key)` returns what the player's own layout prints on that key, such as `Z` for `y` on a German keyboard, so a [prompt](/guides/user-interface/hud-and-nametags/#interaction-prompts) names the key the player sees.

## Locking the controls

`Game.lockControls(true)` shows the cursor and stops the player's character from responding to input, and `Game.lockControls(false)` gives control back. Each resource keeps a count: pair every `true` with one `false`, and the controls stay locked while any resource holds one. Stopping a resource releases what it held. `Game.areControlsLocked()` tells you whether anything holds a lock.

A focused web view locks the controls and shows the cursor by itself while it has focus, so there is no need to lock them around `Web.focusView`.

## The game's own menus

Each of these switches keeps one of the game's menus from opening, so a resource can put its own interface on the keys behind it:

| Call | Keeps shut |
| --- | --- |
| `Game.setPauseMenuEnabled(false)` | The Field Guide, the game's pause menu, with every page hotkey and the escape key |
| `Game.setMenuPageEnabled(page, false)` | One page of the Field Guide; the rest keeps working |
| `Game.setActionScreenEnabled(false)` | The action screen, where players edit their spell sets |
| `Game.setToolWheelEnabled(false)` | The tool wheel, along with its quick-item slot on the HUD |

The pages are `"inventory"`, `"gear"`, `"talents"`, `"quests"`, `"map"`, `"mail"`, `"collections"`, `"challenges"` and `"settings"`. A page kept shut is greyed out, skipped when paging and ignored by its hotkey.

```js
// client/main.js
// This resource keeps inventories itself, so the game's inventory page stays out of reach.
Game.setMenuPageEnabled("inventory", false);
Game.setToolWheelEnabled(false);
```

Each resource holds a switch once, however often it calls it, and a menu stays shut while any resource holds it. Passing `true` gives back only your own hold. Holds go when the resource stops or reloads and when the player disconnects, so there is nothing to undo. A menu that is already open when you shut it stays open until the player closes it.

`Game.isPauseMenuEnabled()` and its siblings return `false` while any resource keeps that menu shut. `Game.pauseMenuState()` and its siblings also name the resources holding it, for finding out which one does.

## Where to go next

- [Web views](/guides/user-interface/web-views/) for drawing the menus that replace the game's.
- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) for prompts that tell players which key to press.
