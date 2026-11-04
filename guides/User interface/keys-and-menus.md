---
title: Keys and menus
description: Bind keyboard and mouse keys, lock the game's controls or single moves while players use your interface, keep the game's own menus closed so your resource can replace them, and follow the player's spell sets.
sidebar:
  order: 630
---

Client scripts can listen for keys of their own, take the game's controls away while players use an interface, keep the game's own menus from opening so the keys behind them can open yours, and follow what the player does with their spells.

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

To stop the character without showing the cursor, as in a cutscene, use `LocalPlayer.stopPlayerInput()`. Movement, casting and the other controls stop, while the camera still turns. `LocalPlayer.restorePlayerInput()` hands them back. Each resource holds input once, however often it calls `stopPlayerInput`, and input stays stopped while anything holds it, another resource or a server [walk](/guides/players/walking-players/#input-during-a-walk) included. `restorePlayerInput` gives back only your own hold, and returns `true` if input runs again. A hold carries over respawns, and goes when your resource stops or reloads and when the player disconnects.

### Jump, sprint and dodge

`LocalPlayer.setJumpEnabled(false)` makes the jump button do nothing, `LocalPlayer.setSprintEnabled(false)` the sprint button, and `LocalPlayer.setDodgeEnabled(false)` the dodge button: the dodge roll, the combat dodge and the Swift talent's blink. A sprint already running stops at once, while a jump already in the air lands normally and a dodge under way finishes. All three use the game's own locks, the ones it sets itself during its scripted walks and lockouts, so giving yours back never frees a move the game has locked itself.

Each resource holds each one once, however often it calls, and the button stays off while any resource holds it. Passing `true` gives back only your own hold. Holds carry over respawns and travel, and go when the resource stops or reloads and when the player disconnects.

`LocalPlayer.isJumpEnabled()`, `LocalPlayer.isSprintEnabled()` and `LocalPlayer.isDodgeEnabled()` return `false` while any resource holds them off. `LocalPlayer.jumpState()`, `LocalPlayer.sprintState()` and `LocalPlayer.dodgeState()` also list the resources holding them in `holders`, and say in `locked` whether the game's lock is on right now, whoever turned it on.

```js
// client/main.js
// No sprinting, jumping or dodging while the stamina bar is empty.
setInterval(() => {
  const tired = stamina() <= 0;
  LocalPlayer.setSprintEnabled(!tired);
  LocalPlayer.setJumpEnabled(!tired);
  LocalPlayer.setDodgeEnabled(!tired);
}, 100);
```

### Gravity

A client script that flies the player by moving them with `LocalPlayer.setPosition` and their collision off, as in [Landing a scripted flight](/guides/players/walking-players/#landing-a-scripted-flight), leaves them falling as far as the game can tell. A falling player who holds still for 5 seconds more than 10 m from the last ground they stood on counts as stuck in a fall and dies, and gravity's pull between your moves adds to the fall their landing counts.

`LocalPlayer.suspendGravity()` takes the local player's gravity away, so neither happens, and `LocalPlayer.restoreGravity()` gives it back. Like the holds above, each resource holds it once, gravity stays off while any resource holds it, and the hold carries over respawns and goes when the resource stops or reloads and when the player disconnects. `suspendGravity` always returns `true`, and takes effect once the player has a character if they have none yet. `restoreGravity` returns `true` when gravity is back, and `false` while another resource still holds it.

```js
// client/main.js
function startFlight() {
  LocalPlayer.suspendGravity();
  LocalPlayer.setCollision(false);
}

function endFlight() {
  LocalPlayer.resetFall();
  LocalPlayer.setCollision(true);
  LocalPlayer.restoreGravity();
}
```

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

## The player's spells

A resource that draws its own spell bar, or keeps the action screen shut, can follow the player's spells from a client script.

The spell bar holds up to four sets of four spells, and the player switches between them with F1 to F4, the mouse wheel or a controller. `Spells.currentLoadout()` returns the set the HUD shows and casts from, 0 to 3, or `null` when it cannot be read. `spellLoadoutChanged(loadout, previous)` fires whenever that set changes, whatever changed it. It only reports switches, so read `currentLoadout()` as your script starts. `Spells.loadout(index)` reads the spells in a set.

```js
// client/main.js
Events.on("spellLoadoutChanged", (loadout) => {
  const set = Spells.loadout(loadout);
  if (set) Game.notify(`Spell set ${loadout + 1}: ${set.slots.filter(Boolean).join(", ")}`);
});
```

`spellCast(spellPath)` fires as the player casts a spell. Lumos and Disillusionment stay on until the player casts them again or something else ends them, and `spellStopped(spellPath)` fires as one goes off, with the path its `spellCast` gave.

For the spells cooling down, see [Reading cooldowns on the client](/guides/pvp/hits-and-defeat/#reading-cooldowns-on-the-client).

## Where to go next

- [Web views](/guides/user-interface/web-views/) for drawing the menus that replace the game's.
- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) for prompts that tell players which key to press.
