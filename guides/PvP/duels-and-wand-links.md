---
title: Duels and wand links
description: Run one-on-one duels with pairs and kneeling defeats, and stage the game's wand link, where two duellists' beams lock and they push for the upper hand.
sidebar:
  order: 480
---

A duel is two players made hostile to each other for a while, whatever the rest of the server is doing. A wand link is the game's own beam contest, which you can stage between any two players, inside a duel or not.

## A duel

A [pair](/guides/pvp/rules-and-relations/#pairs) makes two players hostile without touching anyone else, and a kneeling defeat ends the duel without killing anybody:

```js
// server/main.js
const duels = new Map(); // player id -> opponent

function startDuel(first, second) {
  if (!Pvp.setPair(first, second, { hostile: true, aim: "lock", defeat: "kneel" })) return false;
  for (const player of [first, second]) player.setHealthRecovery(false);
  duels.set(first.id, second);
  duels.set(second.id, first);
  first.sendChat(`Duel with ${second.nickname}: begin!`);
  second.sendChat(`Duel with ${first.nickname}: begin!`);
  return true;
}

function endDuel(player) {
  const opponent = duels.get(player.id);
  if (!opponent) return;
  duels.delete(player.id);
  duels.delete(opponent.id);
  Pvp.setPair(player, opponent, null);
  for (const p of [player, opponent]) if (p.connected) p.setHealthRecovery(true);
}

Events.on("pvpDefeat", (victim, winner) => {
  if (duels.get(victim.id)?.id !== winner.id) return;
  Chat.sendToAll(`${winner.nickname} won the duel against ${victim.nickname}.`);
  endDuel(victim);
});

Events.on("playerDisconnect", (player) => endDuel(player));
```

Turning health recovery off keeps a duellist from healing between spells. A pair ends by itself when either player leaves, but their opponent's recovery is yours to turn back on. The server holds at most 32 pairs, so check what `setPair` returns.

## Wand links

In a wand link, two players' beams meet in the middle and each pushes to drive the clash towards the other. `WandLink.start(a, b, options)` stages one and returns it:

```js
// server/main.js
function startClash(first, second) {
  try {
    return WandLink.start(first, second, { maxDistance: 1500 });
  } catch (error) {
    first.sendChat("You cannot lock wands with them right now.");
    return null;
  }
}
```

`start` throws when the two cannot link: either is not connected, dead, riding or already linked, they are in different virtual worlds, or they are closer than 1.5 m or farther than `maxDistance` centimetres (4000 by default). `ratio` sets where the clash starts, 0.5 by default.

The beams fire about three seconds in, and `link.connected` turns true once they meet. Linked players cannot cast, though your key bindings still fire.

`link.ratio` is where the clash stands, from 0 at the first player's end to 1 at the second's. You can set it, and `link.push(player, amount)` pushes it towards the other player and returns the new ratio. The link does not decide a winner: your script does, and calls `link.end(winner)`, which drives the clash home. `link.end()` without a winner calls it off.

```js
// server/main.js
Events.onClient("clash:push", (player) => {
  const link = WandLink.of(player);
  if (!link || !link.connected) return;
  const ratio = link.push(player, 0.04);
  if (ratio === 1) link.end(link.playerA);
  else if (ratio === 0) link.end(link.playerB);
});
```

```js
// client/main.js
Key.bind("e", () => Events.emitServer("clash:push"));
```

`wandLinkEnded` fires with the link, the winner or `null`, and why it ended: `"ended"`, `"cancelled"`, `"playerLeft"` or `"playerDied"`. The link ends by itself only when a player leaves or dies, not when they move apart.

A wand link does no damage and does not need the players to be hostile. To make the loser pay, change their health in `wandLinkEnded`, or start a duel there. `WandLink.of(player)` returns a player's link, and `WandLinkManager.getAll()` lists them. A link outlasts the resource that started it.

## Where to go next

- [Hits and defeat](/guides/pvp/hits-and-defeat/) for kneeling and health recovery.
- [Keys and menus](/guides/user-interface/keys-and-menus/#binding-keys) for the push key.
