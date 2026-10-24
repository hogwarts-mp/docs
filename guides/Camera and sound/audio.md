---
title: Audio
description: Play the game's sounds at a place, on a player or for one player, stop sounds that keep playing, load soundbanks and change the music, from the server or a client.
sidebar:
  order: 710
---

Every sound in the game is a Wwise event, named like `cabbage_explosion` or `accio_cast`. The server's `Audio` global plays events on players' clients, and a client's `Audio` plays them for its own player. Event names ignore case, and positions and ranges are world centimetres.

## Playing sounds from the server

| Call | Who hears it |
| --- | --- |
| `Audio.playSoundAt(event, x, y, z, options)` | Players within `range` of the point, from that point |
| `Audio.playSoundOnPlayer(player, event, options)` | Players within `range` of the player, from the player as they move, the player included |
| `Audio.playSoundForPlayer(player, event, options)` | Only that player, at full volume wherever they are |
| `Audio.playSoundForAll(event, options)` | Every connected player, at full volume wherever they are |

`range` is 10000 (100 m) by default, and 0 sends the sound to everyone. Each call returns a sound id for `Audio.stopSound(id)`:

```js
// server/main.js
function thunderAt(x, y, z) {
  return Audio.playSoundAt("Amb3D_Storm_ThunderClaps_Play", x, y, z, { range: 20000 });
}
```

The server sends a sound once, to the players in range as it starts. A player who arrives or joins afterwards does not hear it, and a player still on a loading screen misses it.

`Audio.playSoundOnPlayer` reaches only players who share that player's [virtual world](/guides/core-concepts/virtual-worlds/) and map. `Audio.playSoundAt` reaches players in any world unless you give it a `virtualWorld`, a `map` (an [`areaId`](/guides/core-concepts/virtual-worlds/#worlds-and-maps)) or both; the one you leave out is world 0 or Overland. Then only players in that world of that map hear it, and a `range` of 0 reaches every one of them.

## Sounds that keep playing

Some events play once and end, and others, such as loops and charging spells, keep playing until something stops them. `Audio.stopEventFor(event)` returns the name of the event that stops one, or an empty string for a sound that ends by itself.

Pass `duration` in seconds to end a sound by itself, or keep its id and call `Audio.stopSound(id)`. Stopping a sound plays its stop event first, looked up from the game's soundbanks, and `stopEvent` names a different one:

```js
// server/main.js
function castEffect(player) {
  Audio.playSoundOnPlayer(player, "accio_cast", { duration: 3 });
}
```

On the server, `Audio.stopAllSounds()` stops every sound on every client, the game's own music and ambience included, for when a sound keeps playing and nobody has its id. A client's `Audio.stopAll()` does the same for that player.

## Playing sounds on the client

A client's `Audio.playSoundAt(event, x, y, z, options)` plays a sound only its own player hears, from a point. `Audio.playSound(event, options)` plays one on the player's own character, at full volume. Both take `duration` and `stopEvent`, and return an id for `Audio.stopSound`, or 0 when the game refused the sound. `Audio.stopOnSelf()` stops everything playing on the player's character.

This pair plays a sound from a point for the players you pick, such as one team:

```js
// server/main.js
function playForTeam(team, event, x, y, z) {
  for (const player of team) player.emit("sound:play", JSON.stringify({ event, x, y, z }));
}
```

```js
// client/main.js
Events.on("sound:play", (sound) => {
  Audio.playSoundAt(sound.event, sound.x, sound.y, sound.z);
});
```

## Soundbanks

Wwise keeps events in soundbanks, and the game loads its banks as players move around. When a sound's bank is not loaded, the client loads it and tries the sound again, so you rarely need to load a bank yourself. `Audio.bankFor(event)` names the bank an event needs.

`Audio.loadBank(name)` and `Audio.unloadBank(name)` load and unload a bank, on every client from the server or on one client from a client script. A bank of your own is a `.bnk` file that must be in the game's `Phoenix/Content/WwiseAudio/Windows/` folder on each player's machine.

## Music

`Audio.setMusic(event, priority)` puts a track on the game's music stack, at `priority` 5 by default, which plays over the game's own score. `Audio.clearMusic(event)` takes it off, and whatever was underneath plays again. Only events that start a track work: most of the game's music events only switch the score between moods. A name you have cleared cannot be used again in the same session.

`Audio.setState(group, state)` and `Audio.setRTPC(name, value)` set Wwise states and parameters for the whole sound engine, mostly useful with soundbanks of your own.

Music, states, parameters and loaded banks are sent from the server once, to the players connected at the time, so set them again for players who join later.

## The player's volume

`Settings.getAudio()` reads the player's own volume settings, from 0 to 1, and `Settings.setAudio(patch, options)` changes them. These are the player's choices, so only write them from a settings panel they opened. Voice chat has its own volume, [`Voice.setVolume`](/guides/camera-and-sound/voice-chat/#on-the-client).

## Where to go next

- [Voice chat](/guides/camera-and-sound/voice-chat/) for players talking to each other.
- [Camera](/guides/camera-and-sound/camera/) for the pictures to go with the sound.
