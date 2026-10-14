---
title: Authority
description: What the server decides, what players' clients run and report, and how to handle what a client sends.
sidebar:
  order: 200
---

A HogwartsMP server and its players' clients split the work. The server owns the state that matters, and each client runs the game for its player and reports what happens in it. Knowing which side owns what tells you which input to trust.

## What the server owns

The server's word is final for:

- **Which entities exist.** NPCs, beasts, world objects, effects and characters are created on the server, and clients build what they are sent.
- **World state:** the clock, calendar, season, weather and holiday decor, and `World.state`.
- **Each player's inventory.** The server holds the model, its reads never consult the client, and a client's report of its game's inventory never grants an item.
- **What the server sets on a player:** their house and gender, whether other players can see them (`player.setVisible`), and holds that pin them to an anchor (`player.hold`). Their own client cannot undo these.
- **PvP outcomes.** Every hit is arbitrated on the server and priced by its policy before the victim takes it.
- **Loot.** A take is accepted only up to what the player can see in the lootable.
- **Entity state.** Only the server writes [state bags](/guides/core-concepts/state-bags/); clients read them.

## What clients run

Each player's client runs that player's own character: movement, animation, spells and menus. It sends the server its position and the results of what its player does.

Part of the world runs on clients too. An NPC's or beast's AI runs on one nearby player's client, its owner, named by `npc.ownerId` (0 when no client is running it). The server picks the owner and hands the NPC to another player as people come and go. The owner's client reports where the NPC is and what it is doing, so a player can influence the NPCs their own client runs.

## What clients report

Everything a client sends is a claim about its own game, and a modified client can claim anything. Treat these as untrusted:

| Input | What to know |
| --- | --- |
| `Events.onClient` payloads | Any shape and size, as often as the client likes. |
| `playerDied`, `playerDowned`, `playerDownedEnd` | Sent over a dedicated channel that `Events.emitServer` cannot fake, but the client still decides when to send them. |
| `npcDamaged` | Clamped and rate-capped by the server, but reported by the attacker's client. |
| `playerInventoryChanged`, `playerInventoryNativeDelta` | The client's account of its game's inventory. Adopt a delta with `player.inventory.adoptNative()` only for items on an allowlist. |
| `playerLocationChanged`, teleport and fast-travel completions | The client's account of where it is and how a request went. |
| `housePointsRequest`, `beastCared`, `beastCaptureStart`, `beastCaptureRequest` | Requests. They take effect unless a handler refuses them by returning `false`. |
| `doorUnlockRequest` | A request. The door stays locked unless a script releases it. |
| `steamId`, `epicId`, `discordId`, `hardwareId` | Announced by the client. Never authorize anyone with them. |

`pvpHit` is different: it reports a hit the server has already arbitrated, so its amounts are the server's.

## Handling what a client sends

Check a client's input in this order: its shape, its rate, whether this player may do it, and whether the server's current state allows it. Decide from what the server knows, never from what the client claims:

```js
// server/main.js
const lastPurchase = new Map();

Events.onClient("shop:buy", (player, payload) => {
  // Shape: the payload is whatever the client chose to send.
  if (!payload || typeof payload.itemId !== "string" || !Number.isInteger(payload.count)) return;
  if (payload.count < 1 || payload.count > 10) return;

  // Rate: one purchase a second per player.
  const now = Date.now();
  if (now - (lastPurchase.get(player.id) ?? 0) < 1000) return;
  lastPurchase.set(player.id, now);

  // Permission and state: the server's own price list and the server's own balance.
  const price = prices.get(payload.itemId);
  if (price === undefined || !chargeGalleons(player, price * payload.count)) return;
  player.inventory.give(payload.itemId, payload.count);
});

Events.on("playerDisconnect", (player) => lastPurchase.delete(player.id));
```

## Knowing who a player is

The identifiers a client announces are not proof of anything. To know who is joining, have your own website or launcher issue a one-time ticket and check it before the player is let in. `connection.ticket` in `playerConnecting` is the ticket from the launch link the client was started with, passed through untouched:

```js
// server/main.js
Events.on("playerConnecting", async (connection) => {
  const account = await redeemJoinTicket(connection.ticket);
  if (!account) connection.reject("Join from the website to play on this server.");
});
```

The join waits while a handler's promise is pending, so the check can call out to your own service.

## Client scripts belong to the player

Client scripts run on the player's machine, so assume the player can read and change them. Keep prices, secrets and admin checks in `serverScripts`, which [never reach players](/guides/getting-started/first-resource/#what-reaches-the-player). A client script decides what its player sees; anything that should change the game is a request to the server.

## Where to go next

- [Events](/guides/core-concepts/events/) for the client/server bridge and the full event catalog.
- [State bags](/guides/core-concepts/state-bags/) for server-written state every client can read.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) for splitting players into separate instances of the world.
