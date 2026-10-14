---
title: Loot
description: Place chests, moonstone deposits and foragables the server owns, decide what each player finds in them, refill them, and switch off the game's own loot.
sidebar:
  order: 530
---

Players loot the world the game's way: they open chests with F, break moonstone deposits with a spell and pick up foragables with F. The server can own any of these, so that what they hold, who can take it and when it refills are your resource's to decide.

## Placing a lootable

```js
// server/main.js
const chestId = Lootables.place("chest", x, y, z, 90, {
  items: [{ itemId: "Edurus", count: 2 }, { itemId: "LacewingFlies", count: 5 }],
});
```

`Lootables.place(kind, x, y, z, yaw, options)` places a lootable for every player and returns its id, or 0 if it could not be placed. `kind` is `"chest"`, `"moonstone"` or `"foragable"`.

| Option | Meaning |
| --- | --- |
| `items` | What it holds, as `{ itemId, count }` entries with ids from the [inventory catalog](/guides/players/inventory/#reading) |
| `locked` | A locked lootable offers nothing to take |
| `mode` | `"shared"` (the default): a take empties it for everyone. `"perPlayer"`: a take empties it only for the player who took it. |
| `model` | The Blueprint to show. It defaults to a Hogwarts chest, a small moonstone deposit, or the foragable plant that gives the item. |

Moonstone deposits and foragables hold plain items only, and a foragable holds a single stack. A moonstone takes one of the `BP_Moonstone_S`, `_M` or `_L` Blueprints, and a foragable one of the game's five foragable Blueprints. An empty or locked moonstone shows as mined out, and an empty or locked foragable as picked.

`Lootables.get(id)` and `Lootables.list()` describe lootables, and `Lootables.remove(id)` removes one from every player.

## Taking items

When a player takes from a lootable, the server accepts the take only up to what that player sees in it, and adds the items to their [inventory](/guides/players/inventory/) by itself. Then `lootableTaken` fires with the player, the lootable's id and the items they took:

```js
// server/main.js
Events.on("lootableTaken", (player, lootableId, items) => {
  if (lootableId !== chestId) return;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  Chat.sendToAll(`${player.nickname} looted the treasure chest (${total} items).`);
  setTimeout(() => Lootables.setItems(chestId, [{ itemId: "Edurus", count: 2 }]), 10 * 60 * 1000);
});
```

Who may loot what, when a lootable refills and whether its contents survive a restart are all up to your resource. Lootables are not saved: a restart removes them, so place them again when your resource starts.

| Call | Changes, for every player without a view |
| --- | --- |
| `Lootables.setItems(id, items)` | What it holds; an empty list empties it |
| `Lootables.setLocked(id, locked)` | Whether it can be taken from |
| `Lootables.setMode(id, mode)` | `"shared"` or `"perPlayer"` |

## What one player sees

`Lootables.setView(id, player, view)` overrides what one player finds in a lootable: its `items`, whether it is `locked`, or both. Fields you leave out keep the lootable's own value, and `null` drops the view. A view lasts for the player's connection, so re-apply views when a player rejoins if they should last longer.

```js
// server/main.js
function showDailyReward(player, alreadyClaimed) {
  Lootables.setView(chestId, player, alreadyClaimed ? { items: [] } : { items: [{ itemId: "Edurus", count: 1 }] });
}
```

`Lootables.getView(id, player)` returns a player's view, or `null` when they see the lootable's own contents.

## Switching off the game's own loot

The game places its own chests, coin pouches, moonstone deposits and foragables everywhere, and each player's game spawns and empties them separately. To make your lootables the only loot, switch the game's families off with `World.suppressLoot`:

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.suppressLoot({ chests: true, pouches: true, moonstones: true, foragables: true });
});
```

Suppressed chests and coin pouches are hidden, prompt and all, and Overland's moonstone and foragable spawns are removed along with placed deposits and foragables. Room of Requirement storage and quest containers are never touched. Spawns are removed only from areas that load after the change, so call it when your resource starts. `false` switches a family back on, a family you leave out keeps its setting, and `World.lootSuppressed` reads the current settings.

## Where to go next

- [Inventory](/guides/players/inventory/) for what happens to taken items.
- [Objects and effects](/guides/world/objects-and-effects/) for decorating the places your loot sits.
