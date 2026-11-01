---
title: Activities
description: Start the game's own animated activities on players, from flying a Magic Kite Battle kite to opening a Howler, from the server or a client script, and end them again.
sidebar:
  order: 335
---

An activity is a pose with a companion the game animates by itself. Each one comes from one of the game's world events. In the kite, for example, the player raises their wand into the kite flier's pose from the Magic Kite Battle, and the event's own kite flies up from their wand tip on its rope. Everyone sees it, including players who arrive while it is up.

For a pose on its own, play a clip with `LocalPlayer.playClip` (see [Seating the player](/guides/players/walking-players/#seating-the-player)). For a mesh in a player's hand, see [Holding props](/guides/players/appearance/#holding-props).

## The activities

| Id | What the player does | Variants |
| --- | --- | --- |
| `kite` | Flies a kite from the Magic Kite Battle on its rope from their wand. | The kites (below). Defaults to the player's house kite, or the phoenix without a house. |
| `fireworks` | Casts the Fireworks event's bursts from their wand, over and over. | None |
| `raincloud` | Stands under the cloud from Why Does It Always Rain On Me. | `rain` or `snow`. Defaults to snow in winter, as the event does. |
| `snitch` | Watches a Golden Snitch from Loose Snitch flit about over their head. | None |
| `band` | Conducts the One Man Band's instruments, which play around them to the band's music. | None |
| `howler` | Opens a Howler from Verbal Warning, which shouts its message at them and then bursts. | `female` or `male`, the voice it shouts in. Defaults to one at random. |
| `livingbook` | Watches a book from Living Books flap open before them. | The book's effect (below). Defaults to `fireflies`. |
| `cards` | Holds up a deck from Shuffling Cards, which runs through its tricks by itself. | None |

These are the kite's variants:

| Variant | Kite |
| --- | --- |
| `gryffindor`, `hufflepuff`, `ravenclaw`, `slytherin` | The house kites the students fly |
| `kelpie`, `occamy`, `phoenix`, `swoopingevil` | The kites the villagers fly |

A living book opens on one of `fireflies`, `snow`, `leaves`, `runes`, `constellations`, `ghost`, `storm`, `pranks` or `dragons`.

## Starting an activity

`player.startActivity(id, variant)` starts an activity on a player, replacing one they already have. Leave the variant out for the activity's default. `player.finishActivity()` ends it, and the activity winds down in its own way: the kite flies back to the wand while the player plays the flier's wind-down, and the cloud rains itself out.

```js
// server/main.js
// "/kite" flies your house's kite; "/kite land" reels it in.
Events.on("chatCommand", (player, message, command, args) => {
  if (command.toLowerCase() !== "kite") return;
  if (args[0] === "land") player.finishActivity();
  else player.startActivity("kite");
});
```

An unknown id or variant throws a `RangeError`.

```js
// server/main.js
// A kite festival: everyone on the hill flies the same kite.
function startFestival(players) {
  for (const player of players) player.startActivity("kite", "occamy");
}

// A Howler for a player who broke the rules, in a voice of your choosing.
function sendHowler(player) {
  player.startActivity("howler", "female");
}
```

The player's own game starts the activity, so the server hears nothing back when it refuses: with no body, while dead, or while riding a broom or creature. `player.getActivity()` reads the activity their game last reported, as `{ id, variant }`, or `null` without one. It catches up with `startActivity` once their game has started it, so read it a moment later, not straight away. An activity without variants reports its variant as `""`.

## What ends an activity

Most activities last as long as the pose:

- `finishActivity` ends it and plays the wind-down, where the activity has one.
- Moving, `LocalPlayer.stopEmote()` or any other clip ends the pose, and the activity ends with it. Start an activity on a player who is standing still.
- Dying, mounting a broom or creature, taking an [animal form](/guides/players/appearance/#animal-forms) or being hidden with `player.setVisible(false)` ends it at once.
- Starting another activity, or the same one with another variant, replaces it. A kite that is replaced reels in while the new one goes up.

The Howler is the exception: it ends the activity by itself. Once it has shouted its message it bursts, and the player recovers from the shock. `getActivity()` then reads `null`. You can still end it early, which bursts the Howler on the spot.

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
for (const activity of LocalPlayer.listActivities()) {
  const kinds = activity.variants.length ? activity.variants.join(", ") : "no variants";
  console.log(`${activity.id}: ${kinds}`);
}
```

An activity is part of how the player looks, which their own game decides, like a held prop. A modified client can start or end one without the server, so don't base rules on it.

## How other players see it

Each game builds the companion itself for every player with an activity, from the activity it receives with that player. The kite flies its own path and draws its own rope, the snitch picks its own flights, and the instruments, the book and the deck all run their own animations. They move the same way for everyone without any traffic of their own, though not in lockstep: two players may see a snitch take different flights.

The Howler's message works the same way. Each game plays it in the chosen voice, but draws its own lines, so two players may hear different words. The first companion of each kind a game shows is loaded on the spot, which can cost a brief hitch.

## Where to go next

- [Appearance](/guides/players/appearance/) — clothes, size, animal forms and props in a player's hand.
- [Walking and seating players](/guides/players/walking-players/) — walking players, seating them, and holding a pose with a clip.
- [Authority](/guides/core-concepts/authority/) — what the server owns and what a player's own game decides.
