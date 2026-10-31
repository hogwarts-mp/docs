---
title: Activities
description: Start the game's own animated activities on players, such as flying a Magic Kite Battle kite, from the server or a client script, and end them again.
sidebar:
  order: 335
---

An activity is a pose with a companion the game animates by itself. The first is the kite from the Magic Kite Battle world event, where students fly kites out in the open world: the player raises their wand into the kite flier's pose, and the event's own kite flies up from their wand tip on its rope. Everyone sees it, including players who arrive while it is up.

For a pose on its own, play a clip with `LocalPlayer.playClip` (see [Seating the player](/guides/players/walking-players/#seating-the-player)). For a mesh in a player's hand, see [Holding props](/guides/players/appearance/#holding-props).

## Starting an activity

`player.startActivity(id, variant)` starts an activity on a player, replacing one they already have. The variant picks which kite flies. Leave it out for the activity's default, which for the kite is the player's house kite, or the phoenix without a house. `player.finishActivity()` ends it: the kite flies back to the wand while the player plays the flier's wind-down.

```js
// server/main.js
// "/kite" flies your house's kite; "/kite land" reels it in.
Events.on("chatCommand", (player, message, command, args) => {
  if (command.toLowerCase() !== "kite") return;
  if (args[0] === "land") player.finishActivity();
  else player.startActivity("kite");
});
```

An unknown id or variant throws a `RangeError`. These are the kite's variants:

| Variant | Kite |
| --- | --- |
| `gryffindor`, `hufflepuff`, `ravenclaw`, `slytherin` | The house kites the students fly |
| `kelpie`, `occamy`, `phoenix`, `swoopingevil` | The kites the villagers fly |

```js
// server/main.js
// A kite festival: everyone on the hill flies the same kite.
function startFestival(players) {
  for (const player of players) player.startActivity("kite", "occamy");
}
```

The player's own game starts the activity, so the server hears nothing back when it refuses: with no body, while dead, or while riding a broom or creature. `player.getActivity()` reads the activity their game last reported, as `{ id, variant }`, or `null` without one. It catches up with `startActivity` once their game has started it, so read it a moment later, not straight away.

## What ends an activity

The activity lasts as long as the pose:

- `finishActivity` reels the kite in and plays the wind-down.
- Moving, `LocalPlayer.stopEmote()` or any other clip ends the pose, and the kite reels in with it. Start an activity on a player who is standing still.
- Dying, mounting a broom or creature, taking an [animal form](/guides/players/appearance/#animal-forms) or being hidden with `player.setVisible(false)` ends it at once.
- Starting another activity, or the same one with another variant, replaces it: the old kite reels in while the new one goes up.

Nothing is kept for later. An activity ends with the visit, like a held prop.

## From a client script

`LocalPlayer.startActivity(id, variant)` starts an activity on the local player and returns `false` when it cannot: an unknown id or variant, no body, dead or riding. `LocalPlayer.finishActivity()` ends it, and returns `false` when none was under way. `LocalPlayer.getActivity()` reads it at once.

```js
// client/main.js
// K flies your house's kite, and K again lands it.
Key.bind("k", () => {
  if (LocalPlayer.getActivity()?.id === "kite") LocalPlayer.finishActivity();
  else LocalPlayer.startActivity("kite");
});
```

`LocalPlayer.listActivities()` lists every activity with its variants, for a menu that offers what the game has:

```js
// client/main.js
const kite = LocalPlayer.listActivities().find((activity) => activity.id === "kite");
console.log(`kites: ${kite?.variants.join(", ")}`);
```

An activity is part of how the player looks, which their own game decides, like a held prop. A modified client can start or end one without the server, so don't base rules on it.

## How other players see it

Each game builds the kite itself for every player flying one, from the activity it receives with that player. The kite flies its own path and draws its own rope, so it moves the same way for everyone without any traffic of its own. The first kite of each kind a game shows is loaded on the spot, which can cost a brief hitch.

## Where to go next

- [Appearance](/guides/players/appearance/) — clothes, size, animal forms and props in a player's hand.
- [Walking and seating players](/guides/players/walking-players/) — walking players, seating them, and holding a pose with a clip.
- [Authority](/guides/core-concepts/authority/) — what the server owns and what a player's own game decides.
