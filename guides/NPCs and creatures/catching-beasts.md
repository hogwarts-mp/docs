---
title: Catching beasts
description: Let players catch beasts with the Nab-Sack, referee each catch, keep what they catch across reconnects, and release beasts back into the world.
sidebar:
  order: 425
---

Players catch [beasts](/guides/npcs-and-creatures/beasts-and-characters/#beasts) with the game's Nab-Sack. The server referees every catch, so a beast goes into one player's bag and leaves every player's world. The bag is the game's own, shown in the player's Field Guide, but it belongs to the connection: it is empty when a player joins and gone when they leave. A server that keeps catches saves the bag itself.

## Making a beast catchable

No beast can be caught until a script allows it, and players need the Nab-Sack, the `CaptureDevice` tool:

```js
// server/main.js
Events.on("worldReady", (player) => {
  if (!player.inventory.has("CaptureDevice")) player.inventory.give("CaptureDevice", 1);
});

const niffler = Beast.create("Niffler", { x, y, z });
niffler.capturable = true;
```

| Member | Meaning |
| --- | --- |
| `beast.capturable` | Whether players may catch it. False by default |
| `beast.setCapturableFor(player, value)` | `true` or `false` for one player whatever `capturable` says; `null` returns them to it. Dropped when the player leaves |
| `beast.capturableFor(player)` | Whether this player may catch it: their override, or `capturable` |
| `beast.caged` | Caged beasts are refused for everyone |

A player who may not catch a beast is turned away by their own Nab-Sack, with the game's "This beast cannot be rescued", or "Caged beasts cannot be rescued" for a caged one. Their attempt never reaches your scripts.

```js
// server/main.js
// Only the player who earned it may catch the reward hippogriff.
const reward = Beast.create("Hippogriff", { x, y, z, name: "Buckbeak" });
reward.setCapturableFor(player, true);
```

## Refereeing a catch

A catch reaches the server twice. Both events run synchronously, so a handler that returns `false` refuses it:

1. The Nab-Sack starts drawing in the beast, and `beastCaptureStart(beast, player)` fires. Refuse it and the Nab-Sack lets go.
2. The Nab-Sack finishes, and the player's game holds the catch until the server answers. The server checks that the beast is still there, within 25 m, in a [virtual world](/guides/core-concepts/virtual-worlds/) the player can see, catchable for them, not caged and not already being caught by someone else. Then `beastCaptureRequest(beast, player)` fires. Refuse it and the beast stays in the world.

Once a catch is approved, the beast leaves every player's world, the server destroys it, and `beastCaptured(player, captured)` fires with the new bag entry. When two players catch the same beast, the first catch approved wins.

```js
// server/main.js
const BAG_LIMIT = 6;

Events.on("beastCaptureRequest", (beast, player) => {
  if (Beast.bagOf(player).length >= BAG_LIMIT) {
    player.sendChat(`Your Nab-Sack is full. Release a beast before catching the ${beast.species}.`);
    return false;
  }
});

Events.on("beastCaptured", (player, captured) => {
  player.sendChat(`You caught a ${captured.species}.`);
});
```

The server also rate-limits what each client reports about its catches.

## The bag

`Beast.bagOf(player)` lists a player's bag: what they caught on this connection and what scripts gave them. Each entry is `{ id, species, color, gender, name }`. Its `id` names the entry for `Beast.takeCaptured` and lasts only as long as the connection, so never store it.

| Call | Effect |
| --- | --- |
| `Beast.giveCaptured(player, beast)` | Puts a beast in the bag, in the player's Field Guide too, without the game's catch notification. Takes `species` and optional `color`, `gender` and `name`. Returns the new entry, or `null` when the player is not connected |
| `Beast.takeCaptured(player, id)` | Takes a beast out of the bag and the player's Field Guide. `false` when the bag holds no such entry |

`giveCaptured` throws, like `Beast.create`, for an unknown species, a colour the species does not have, a gender other than `"male"` or `"female"`, or a name over 64 UTF-8 bytes. Leave `color` out to roll on the game's own weights, and `gender` to give a male. A beast given before the player's game is ready reaches it once it is.

## Keeping catches

Because the bag belongs to the connection, save it whenever it changes and give it back when the player joins. Save the species, colour, gender and name, not the entry ids:

```js
// server/main.js
function keepBag(player) {
  const beasts = Beast.bagOf(player).map(({ species, color, gender, name }) => ({ species, color, gender, name }));
  saveBag(player, beasts);
}

Events.on("beastCaptured", (player) => keepBag(player));
Events.on("beastReleased", (player) => keepBag(player));

Events.on("playerConnect", async (player) => {
  const saved = await loadBag(player);
  if (!saved || !player.connected) return;
  for (const beast of saved) Beast.giveCaptured(player, beast);
});
```

`saveBag` and `loadBag` stand for your own store, such as the database behind [Persisting state](/guides/getting-started/first-resource/#persisting-state). Call `keepBag` after your own `giveCaptured` and `takeCaptured` calls too.

## Releasing beasts

When a player releases a beast from their Field Guide, the game drops it from the bag, and `beastReleased(player, released, at)` fires. `released` is the entry as it was, and `at` is where the player stood. The game does not put the beast back in the world, so bring it back yourself if you want it there:

```js
// server/main.js
Events.on("beastReleased", (player, released, at) => {
  const { species, color, gender, name } = released;
  const beast = Beast.create(species, { x: at.x, y: at.y, z: at.z, color, gender, name, preferredOwnerId: player.id });
  beast.capturable = true; // anyone may catch it again; leave this out to keep it wild
});
```

A script can release a beast without the Field Guide, for example from a menu of its own on a server that [keeps the Field Guide shut](/guides/user-interface/keys-and-menus/#the-games-own-menus). Take the beast out of the bag and create it in the world. This one appears 3 m in front of the player, facing them:

```js
// server/main.js
function releaseInFront(player, entryId) {
  const entry = Beast.bagOf(player).find((beast) => beast.id === entryId);
  if (!entry || !Beast.takeCaptured(player, entry.id)) return null;
  const yaw = player.location()?.yaw ?? 0;
  const radians = (yaw * Math.PI) / 180;
  const { x, y, z } = player.position;
  return Beast.create(entry.species, {
    x: x + Math.cos(radians) * 300,
    y: y + Math.sin(radians) * 300,
    z,
    yaw: yaw + 180,
    color: entry.color,
    gender: entry.gender,
    name: entry.name,
    preferredOwnerId: player.id,
  });
}
```

`takeCaptured` does not raise `beastReleased`, so save the bag afterwards as well.

## Where to go next

- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for spawning beasts, their options, and petting and feeding them.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for keeping a beast to the players who should see it.
- [Keys and menus](/guides/user-interface/keys-and-menus/) for putting your own interface in place of the game's menus.
