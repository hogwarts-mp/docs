---
title: Voice chat
description: Who hears whom in proximity voice chat, how far voices carry, whispering and shouting, muting players, and the voice settings each player controls.
sidebar:
  order: 720
---

Players talk to the people near them, holding push-to-talk, which is V by default. The server's `Voice` global decides how far voices carry and who may talk or listen, and each client's `Voice` controls that player's own microphone and volume. Ranges are world centimetres.

## Who hears whom

A player hears someone talking when:

- the talker is within their voice's range, measured between the two characters;
- the two can see each other's [virtual worlds](/guides/core-concepts/virtual-worlds/), so separate worlds are separate conversations;
- the talker is not muted, the listener is not deafened, neither has turned voice chat off, and the listener has not muted the talker.

A voice is at full volume close by and fades to silence at the edge of its range. A talker also has to be near enough for the listener's game to have them loaded, so a range beyond that distance adds nothing. Each player hears at most six people at once.

## How far voices carry

Each player talks on a tier: whisper, normal or shout. HogwartsMP starts them at 8 m, 25 m and 60 m:

| Tier | Number | Range |
| --- | --- | --- |
| Whisper | 0 | 800 |
| Normal | 1 | 2500 |
| Shout | 2 | 6000 |

| Call | Does |
| --- | --- |
| `Voice.setRange(range)` | Sets the normal range, which every player without a range of their own uses |
| `Voice.setTierRange(tier, range)` | Sets one tier's range; 0 makes it carry the normal range |
| `Voice.setPlayerRange(player, range)` | Gives one player a range of their own, whatever their tier; 0 takes it away |
| `Voice.setPlayerTier(player, tier)` | Moves a player to a tier |

`getRange()`, `getTierRange(tier)`, `getPlayerRange(player)` and `getPlayerTier(player)` read them back.

`Voice.setRange` with 0 or less does not restore HogwartsMP's 25 m: it sets 25 cm, which silences everyone. Pass `2500` to go back.

```js
// server/main.js
// Whoever holds the stage is heard across the hall.
function giveStage(player) {
  Voice.setPlayerRange(player, 6000);
}

function takeStage(player) {
  Voice.setPlayerRange(player, 0);
}
```

### Whispering and shouting

HogwartsMP gives players no key for changing tier, so a resource that wants them to whisper or shout binds one on the client. `Voice.setTier(tier)` asks the server to move the player, and the server raises `playerVoiceTierChange` with the player and their new tier:

```js
// client/main.js
const TIER_NAMES = ["Whispering", "Talking", "Shouting"];

Key.bind("f3", () => {
  const tier = (Voice.getTier() + 1) % 3;
  Voice.setTier(tier);
  Game.notify(`${TIER_NAMES[tier]}.`);
});
```

`Voice.setPlayerTier` from the server does not raise the event.

## Muting players

| Call | Does |
| --- | --- |
| `Voice.setPlayerMuted(player, muted)` | Nobody hears the player |
| `Voice.setPlayerDeaf(player, deaf)` | The player hears nobody |
| `Voice.setLocalMute(listener, target, muted)` | One player stops hearing another |

`isPlayerMuted`, `isPlayerDeaf` and `isLocallyMuted` read them back. Changes take effect within a quarter of a second. The muted player is not told, and their voice events keep firing, so tell them yourself.

```js
// server/main.js
// The dead tell no tales.
Events.on("playerDied", (player) => Voice.setPlayerMuted(player, true));
Events.on("playerDownedEnd", (player) => Voice.setPlayerMuted(player, false));
```

All of these belong to the player's connection: they last until the player disconnects, and are gone when they come back. They also outlast the resource that set them, so undo them when your resource stops if it should not leave players muted.

## Who is talking

`playerVoiceStart` and `playerVoiceStop` fire on the server with the player as they start and stop talking, and `Voice.isPlayerTalking(player)` reads it. Silence is not sent, so a pause of more than about 0.3 seconds stops and starts again, and no `playerVoiceStop` fires when a player disconnects mid-sentence.

Clients cannot see who else is talking, so the server tells them. This marks talkers on their nametags:

```js
// server/main.js
Events.on("playerVoiceStart", (player) => Events.emitAllClients("voice:talking", { playerId: player.id, talking: true }));
Events.on("playerVoiceStop", (player) => Events.emitAllClients("voice:talking", { playerId: player.id, talking: false }));
```

```js
// client/main.js
Events.on("voice:talking", (update) => {
  if (update.talking) Nametags.setLabel(update.playerId, "(speaking)", 0);
  else Nametags.clearLabel(update.playerId);
});
```

`Voice.isPlayerVoiceEnabled(player)` tells you whether a player left voice chat on in their settings. It is their preference, not a permission: mute or deafen to enforce anything.

## On the client

A client's `Voice` controls the player's own voice chat:

| Call | Does |
| --- | --- |
| `Voice.setEnabled(enabled)` | Turns voice chat on or off for this player |
| `Voice.setVolume(volume)` | Sets how loud others are, where 1 is normal and 4 the most |
| `Voice.setHearingRange(range)` | Narrows how far this player hears; it cannot widen the server's ranges |
| `Voice.setPushToTalkKey(key)` | Changes push-to-talk, using the [key names](/guides/user-interface/keys-and-menus/#binding-keys) `Key.bind` takes |
| `Voice.setPushToTalkReleaseDelay(ms)` | Keeps sending for up to 2000 ms after the key is released, 100 by default |
| `Voice.setTransmitMode(mode)` | `"pushToTalk"`, or `"voiceActivity"` to send whenever the microphone is loud enough |
| `Voice.setActivationThreshold(level)` | How loud, from 0 to 1, voice activation needs; `Voice.getInputLevel()` reads the microphone for a level meter |
| `Voice.setNoiseSuppression(enabled)` | Filters steady background noise |
| `Voice.setInputDevice(name)` | Picks a microphone from `Voice.getInputDevices()`, or the default for an empty name |

Each has a getter, and `Voice.hasMicrophone()` tells you whether the player has one working. `voiceStart` and `voiceStop` fire on the client as the player starts and stops talking, and `Voice.isTalking()` reads it.

Push-to-talk sends nothing while the chat is open, a [web view](/guides/user-interface/web-views/#focus-and-input) has focus, the controls are locked or the game is in the background. Voice activation keeps sending through all of them.

Nothing here is saved: the settings last until the game closes, and follow the player to other servers they join meanwhile. A resource with a voice settings panel saves the player's choices itself and applies them again when they join.

Voice chat plays outside the game's sound engine, so the game's volume settings and the `Audio` calls do not change it.

## Where to go next

- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for separating groups of players, their voices included.
- [Audio](/guides/camera-and-sound/audio/) for the game's own sounds.
