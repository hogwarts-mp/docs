---
title: Inventory
description: Give, take and move items in a server-owned inventory, change several things at once safely, save inventories between visits, and adopt items the game hands out.
sidebar:
  order: 320
---

Every player's inventory belongs to the server. `player.inventory` is the server's model of it: the player's game shows what the server sends, its reads never ask the client, and nothing the client reports adds an item on its own.

The model lasts as long as the visit. A joining player starts with an empty inventory and it is dropped when they leave, so a server that keeps items between visits [saves and restores them](#saving-inventories) itself.

## Reading

```js
// server/main.js
const items = player.inventory.list();
const flies = player.inventory.count("LacewingFlies");
const canBrew = player.inventory.has("LeechJuice", 2);
```

Each row in `list()` is an item:

| Field | Meaning |
| --- | --- |
| `itemId` | The game's item id, such as `LacewingFlies` |
| `holder` | The section of the game's inventory the row sits in, such as `ResourceInventory` |
| `count` | How many |
| `kind` | `"item"`, `"gear"`, `"tool"` or `"mount"` |
| `variation` | Gear's own variant id; empty for ordinary items |
| `unique` | Whether the row is a unique item |
| `identified`, `equipped`, `hoodUp` | Gear only: whether it is identified, whether it is worn, and its hood |

`InventoryCatalog` describes every item the game knows: `InventoryCatalog.get(itemId)` returns its default holder, stack size and kind, `has(itemId)` tests an id, and `list(filter)` lists definitions, for example every consumable.

## Changing

| Call | Does |
| --- | --- |
| `give(itemId, count, options, callback)` | Adds `count` of an item, 1 by default |
| `remove(itemId, count, options, callback)` | Takes `count` away |
| `move(itemId, { fromHolder, toHolder, count }, callback)` | Moves a row to another holder |
| `clear(callback)` | Empties the inventory |
| `replace(items, callback)` | Replaces the whole inventory with these rows |

Every change publishes a new `inventory.revision`, and the player's game applies it shortly after. The optional callback runs with `(error, result)`: `error` is `null` on success, and `result.revision` is the revision the change produced.

```js
// server/main.js
player.inventory.give("Edurus", 3, {}, (error, result) => {
  if (error) {
    console.warn(`could not give Edurus: ${error.code} ${error.message}`);
    return;
  }
  player.sendChat(`You received 3 Edurus potions (inventory revision ${result.revision}).`);
});
```

Ids are checked against the catalog: an unknown one fails with `INVALID_ITEM`, and taking more than a player has fails with `INSUFFICIENT_COUNT`. Gear gets a variation of its own when given, and `options` can hand it over identified or already worn:

```js
// server/main.js
player.inventory.give("Back_001_Basic", 1, { equipped: true });
```

## Several changes at once

`patch(operations, options, callback)` applies a list of `give`, `remove` and `move` operations as one change: either all of them happen and the player gets one new revision, or none do. Pass `expectedRevision` to refuse the whole change if the inventory has changed since you looked at it; it then fails with `REVISION_CONFLICT`:

```js
// server/main.js
function buyEdurus(player) {
  const revision = player.inventory.revision;
  if (!player.inventory.has("LacewingFlies", 2) || !player.inventory.has("LeechJuice", 1)) return;

  player.inventory.patch(
    [
      { op: "remove", itemId: "LacewingFlies", count: 2 },
      { op: "remove", itemId: "LeechJuice", count: 1 },
      { op: "give", itemId: "Edurus", count: 1 },
    ],
    { expectedRevision: revision },
    (error) => {
      if (error) player.sendChat(error.code === "REVISION_CONFLICT" ? "Your inventory changed; try again." : "The trade failed.");
    },
  );
}
```

## Saving inventories

The server writes nothing to disk, so save the inventory whenever it changes and give it back when the player returns. `playerInventoryUpdated` fires with every row and the new revision after each change, and `replace` restores a saved list in one step, gear variations included. Restore it once the player's load screen is gone, as you would [move them to a spawn point](/guides/players/join-and-spawn/#putting-players-in-place):

```js
// server/main.js
Events.on("playerInventoryUpdated", (player, items) => {
  saveInventory(player, items);
});

Events.on("loadingFinished", async (player) => {
  const saved = await loadInventory(player);
  if (saved && player.connected) player.inventory.replace(saved);
});
```

Keep the rows as `list()` returns them: `replace` needs a gear row's `variation` to restore that exact piece. `saveInventory` and `loadInventory` stand for your own store, such as the database behind [Persisting state](/guides/getting-started/first-resource/#persisting-state).

## Waiting for the player's game

A change is final on the server at once, and reaches the player's game a moment later. `inventory.waitForRevision(revision)` returns a promise that settles once the player's game has applied that revision, or a newer one. It rejects with a code such as `NATIVE_APPLY_FAILED`, `NATIVE_APPLY_TIMEOUT` or `PLAYER_DISCONNECTED`:

```js
// server/main.js
player.inventory.give("Edurus", 1, {}, async (error, result) => {
  if (error || !result) return;
  try {
    await player.inventory.waitForRevision(result.revision);
    player.sendChat("Your potion is in your bag.");
  } catch (failure) {
    console.warn("the potion did not reach the player's game", failure);
  }
});
```

## Items the game hands out

The player's game still picks up items on its own, for example from loot your scripts do not manage. The server never adds those to its model by itself. Instead, `playerInventoryNativeDelta` reports each addition with a one-time `adoptionId`, and `player.inventory.adoptNative(adoptionId, options, callback)` imports it on purpose. Adopt only items you expect, by passing allowlists:

```js
// server/main.js
Events.on("playerInventoryNativeDelta", (player, delta) => {
  player.inventory.adoptNative(delta.adoptionId, { itemIds: ["LacewingFlies", "LeechJuice"] });
});
```

An addition outside the allowlists fails with `NATIVE_DELTA_NOT_ALLOWED`, and a stale or unknown id with `STALE_NATIVE_DELTA` or `NATIVE_DELTA_NOT_FOUND`. Lootables adopt what a player takes automatically, so they need no handler. `player.inventory.native()` returns what the player's game last reported in full, for comparing; it is the client's claim, not the inventory.

## Using consumables

`player.inventory.use(itemId, options, callback)` uses one potion or plant on the player's game, and completes only once the game shows that exact item was used up. The authoritative inventory changes with it and `playerInventoryConsumed` fires. It fails with `ITEM_NOT_USABLE` for an item the game cannot use from the inventory, and `USE_IN_PROGRESS` while another use is still running.

## Where to go next

- [Join and spawn](/guides/players/join-and-spawn/) for restoring saved data when a player connects.
- [Authority](/guides/core-concepts/authority/) for why client reports never grant items.
