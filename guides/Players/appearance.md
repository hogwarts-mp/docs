---
title: Appearance
description: Save and restore how players look, open the character creator, and change their clothes, house, size, disguise and what they hold.
sidebar:
  order: 330
---

A player's look is their body, face, hair, voice and name. Their own game builds it and sends it to the server, which checks it and shows it to everyone else. The server can read a look, keep it and hand it back, and it controls a player's house, size, disguise and the prop in their hand. Clothes are gear in the player's [inventory](/guides/players/inventory/).

## The look

`player.getLook()` returns the player's look as plain ids:

| Field | Meaning |
| --- | --- |
| `format`, `version` | Always `"hogwartsmp-look"`, and the version of the format |
| `gender` | `"male"` or `"female"` |
| `presets` | The creator's choice for each category, such as `{ hairStyle: "HairFemale040" }` |
| `gear` | What the player wears, as the game's appearance ids |
| `faceGear`, `house`, `scale`, `voice`, `name`, `hood`, `wandStyle` | Present when set: glasses, house colours, size, voice, character name, hood and wand style |

`playerAppearanceChanged` fires with the player, their new look and its revision whenever the look changes, and `player.appearanceRevision` counts those changes for the current visit. A player's game sends at most two looks a second.

## Saving and restoring looks

The server writes nothing down, and every player joins looking like the game's default character. To give players their own look back, save it as it changes and restore it once their loading screen is gone. Before then the player has no body to apply it to:

```js
// server/main.js
const restored = new Set(); // ids of players whose saved look is back on

Events.on("loadingFinished", async (player) => {
  const saved = await loadLook(player);
  if (!player.connected) return;
  if (!saved) {
    restored.add(player.id);
    return;
  }
  player.setLook(saved, (error) => {
    if (error) console.warn(`could not restore ${player.nickname}'s look: ${error.code}`);
    restored.add(player.id);
  });
});

Events.on("playerAppearanceChanged", (player, look) => {
  if (!look || !restored.has(player.id) || Object.keys(look.presets).length === 0) return;
  saveLook(player, JSON.stringify(look));
});

Events.on("playerDisconnect", (player) => restored.delete(player.id));
```

`loadLook` and `saveLook` stand for your own store. Three things the sample guards against:

- The first look a joining player sends is the default character, so saving every change would overwrite their saved look before you restore it.
- Until the player's game sends its first look, `getLook()` returns one with no presets. Do not save that either.
- `setLook` replaces the whole look rather than changing the fields you pass, so always pass a complete look, from `getLook`, the event or the creator.

`player.setLook(look, callback)` takes a look or its JSON text. The callback runs with `(error, result)` once the player's game has rebuilt their character, within 20 seconds, and `result.revision` is the revision it produced. Without a callback, a malformed look throws `INVALID_APPEARANCE`. The server checks a look's shape, not that its ids exist in the game, and the player's game leaves out ids it does not know, so read the look back if it matters.

A look's `gear`, `hood` and `house` show how other players see the player, but do not dress the player themselves. What they wear, their hood and the look a worn item shows all come from their [inventory](/guides/players/inventory/#saving-inventories), so restoring it restores them. Restore the house with [`player.house`](#house-and-gender).

## The character creator

On the client, `Creator.open()` opens the game's character creator over the game, and the player sees their changes on their own character as they make them. When they confirm, their new look reaches the server as `playerAppearanceChanged`, and the client raises `creatorConfirmed` with the name they chose; `creatorCancelled` fires if they back out instead. `Creator.isOpen()` and `Creator.close()` do what they say.

```js
// client/main.js
Events.on("creator:open", () => Creator.open());
Events.on("creatorConfirmed", () => Events.emitServer("creator:done"));
```

A disguised player's game stops sending their look, so take off a [disguise](#disguises) before opening the creator.

A resource can build a creator of its own. `Creator.begin()` starts an editing session, `Creator.getSchema()` lists every category and the ids it accepts, `Creator.applyPatch({ hairStyle: id })` changes categories, and `Creator.commit()` keeps the changes or `Creator.cancel()` puts the old look back. `CreatorPreview.setCamera(frame)` points a camera at the front of the player and `CreatorPreview.rotate(degrees)` turns them, until `CreatorPreview.restoreCamera()`. `Creator.exportLook()` returns the player's look on the client.

`Portrait.capture(request)` renders a picture of a player, or of a saved look, for a [web view](/guides/user-interface/web-views/). One capture runs at a time and takes a second or so: check `Portrait.busy()`, then `Portrait.lastImage()` returns it as a data URI.

## Clothes

What a player wears is gear in their inventory. `player.inventory.give(itemId, 1, { equipped: true })` hands them a piece already worn, and `player.gear.apply(changes, callback)` dresses them in gear they own, slot by slot:

```js
// server/main.js
function wearUniform(player) {
  player.gear.apply({ Outfit: "Outfit_001_Basic", Head: null }, (error) => {
    if (error) player.sendChat(`You do not own the uniform (${error.code}).`);
  });
}
```

`player.gear.slots()` lists the slots, `player.gear.equipped()` what is worn in each, and `player.gear.available(slot)` what the player owns for one. A gear change reaches the server as a new look, and `playerGearChanged` fires with the player.

## House and gender

`player.house` reads or sets the player's house: `"Gryffindor"`, `"Hufflepuff"`, `"Ravenclaw"`, `"Slytherin"` or `"Unaffiliated"`, the default. Setting it changes their robes and crest.

`player.gender` sets which dormitory the game treats the player as belonging to. It does not change their body, which follows the look's `gender`.

## Size

`player.setScale(scale, mode)` resizes a player for everyone, from 0.1 to 10 times. In the default `"full"` mode their collision and the target others lock on to grow with them; `"visual"` resizes only the body and what they wear. `player.getScale()` and `player.getScaleMode()` read it back.

```js
// server/main.js
function startGiantDuel(first, second) {
  first.setScale(3);
  second.setScale(3);
}
```

A look saved while a player is resized carries the size, and restoring it resizes them again.

## Disguises

`player.setTransmog(characterId)` makes a player look like one of the game's characters, to everyone including themselves, and `player.setTransmog("")` takes it off. The server accepts any well-formed id. `Character.isAllowed(characterId)` checks it against the human characters [`Character.create`](/guides/npcs-and-creatures/beasts-and-characters/#characters) can place. The game's ghosts work as disguises too, though most of them fail that check, and a ghost disguise looks ghostly to the player as well. `player.getTransmog()` reads it back.

A disguise is not part of the look: `getLook` never includes it, and `setLook` takes it off.

## Holding props

`player.equipProp(path, options)` puts one of the game's meshes in a player's hand, and everyone sees it. `options.socket` picks the attachment point, `WandSocket` by default, and `options.offset` adjusts its position (in centimetres), rotation and scale. `player.getProp()` reads it, and `player.clearProp()` takes it away.

```js
// server/main.js
function handApple(player) {
  player.equipProp("/Game/Environment/BanditCamps/Bandit_Camp_Shared_Props/Food/SM_BCProps_Apple_A_2bite.SM_BCProps_Apple_A_2bite", {
    socket: "SKT_RightHandSocket",
  });
}
```

A prop handed to a player before they have a body is dropped, so wait for `loadingFinished`.

## Hiding your own body

On the client, `LocalPlayer.setVisibility(false)` hides the player's own body, wand and held prop on their screen only, for a first-person camera or a cutscene. Everyone else still sees them, unless the server hides them with `player.setVisible(false)`. It lasts through respawns and travel until you change it.

## What a visit keeps

House, size, disguise and props last for the visit and are gone when the player reconnects, like the look itself. Save what should last and set it again on `loadingFinished`.

## Where to go next

- [Inventory](/guides/players/inventory/) for the gear players wear.
- [Join and spawn](/guides/players/join-and-spawn/) for the events around a visit.
