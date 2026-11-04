---
title: Field Guide progress
description: Read a character's Field Guide collections and challenges from a client script, save them on the server, give them back on the next visit, and follow progress as the player makes it.
sidebar:
  order: 342
---

The Field Guide keeps two kinds of progress. Its collections hold everything a player has found: pages, traits, wand handles, gear looks, brooms, beasts, enemies, potions, seeds and conjurations. Its challenges count what they have done towards each Challenges tier and homework task. Both live in the player's own game, and every visit starts with a fresh Field Guide.

`FieldGuide` on the client reads that progress, takes a snapshot of it as plain JSON, and restores a snapshot later. A server that keeps Field Guide progress between visits stores the snapshot itself and sends it back when the player returns.

## Reading progress

`FieldGuide.ready()` says whether the game's Field Guide can be read and restored yet. Until it is, `collections`, `challenges` and `snapshot` return `null`.

| Call | Returns |
| --- | --- |
| `FieldGuide.collections(category)` | Every collection item with its state, or only those of one category, matched case-insensitively |
| `FieldGuide.challenges(prefix)` | Every challenge record, or only those whose id starts with `prefix`, such as `"FGC_"` for the Challenges menu |
| `FieldGuide.snapshot()` | Everything `restore` takes back. See [Saving and restoring](#saving-and-restoring) |

A collection item has these fields:

| Field | Meaning |
| --- | --- |
| `id` | The game's item id, such as `LORE_HuffBasement_Stairwell` for a Revelio page |
| `category` | `Beasts`, `Brooms`, `Conjurations`, `Enemies`, `Exploration` (the pages), `Gear`, `Potions`, `Seeds`, `Traits` or `WandStyle` |
| `subcategory` | The collection's own grouping, such as `Hogwarts`, `Hogsmeade` or `Overland` for pages |
| `state` | `"Unknown"`, `"Known"` or `"Obtained"`. Obtained is collected |
| `updated` | The game's own change stamp |

A challenge record has these:

| Field | Meaning |
| --- | --- |
| `id` | The record's id. Each tier of a Challenges entry has its own, such as `FGC_Pages_Hogwarts_000` and `FGC_Pages_Hogwarts_001` |
| `instances` | The progress counted so far |
| `goal` | The tier's target, or 0 when it has none |
| `complete` | Whether the tier is done |
| `counted` | The members already counted, for a challenge that counts each thing once |
| `unclaimedRewards` | Rewards the player has not yet claimed in the Challenges menu |

This counts the pages a player has collected:

```js
// client/main.js
function reportPages() {
  const pages = FieldGuide.collections("Exploration");
  if (!pages) return;
  const found = pages.filter((page) => page.state === "Obtained").length;
  Game.notify(`You have found ${found} of ${pages.length} Field Guide pages.`);
}
```

## Saving and restoring

`FieldGuide.snapshot()` returns the character's whole Field Guide: every collection item, every challenge record, the challenge locks and what keeps collected pages collected in the world. `FieldGuide.restore(snapshot)` puts a snapshot back. Only the client can take a snapshot, so the client sends it to the server to save, and the server sends it back on the next visit.

On the client, this resource asks for the saved snapshot as soon as it starts, restores it once the Field Guide is ready, and saves a snapshot a few seconds after the player's last change. A single pickup can change several records, so the wait saves them together:

```js
// client/main.js
let restored = false;
let saveTimer = null;

Events.emitServer("fieldguide:load");

Events.on("fieldguide:restore", (data) => restoreWhenReady(data.snapshot));

function restoreWhenReady(snapshot) {
  if (!FieldGuide.ready()) {
    setTimeout(() => restoreWhenReady(snapshot), 500);
    return;
  }
  if (snapshot) {
    const result = FieldGuide.restore(snapshot);
    if (!result.ok) console.warn(`Field Guide restore: ${result.reason ?? result.mismatches.join("; ")}`);
    Events.emitServer("fieldguide:restored", { needsTravel: result.needsTravel });
  }
  restored = true;
}

function queueSave() {
  if (!restored) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = FieldGuide.snapshot();
    if (snapshot) Events.emitServer("fieldguide:save", snapshot);
  }, 5000);
}

Events.on("fieldGuideCollectionChanged", queueSave);
Events.on("fieldGuideChallengeChanged", queueSave);
```

The server keeps one snapshot per character and reloads the map around a player whose world was already loaded when the restore ran (see [When the player is already in the world](#when-the-player-is-already-in-the-world)):

```js
// server/main.js
Events.onClient("fieldguide:load", async (player) => {
  const saved = await loadFieldGuide(player);
  if (player.connected) player.emit("fieldguide:restore", JSON.stringify({ snapshot: saved ?? null }));
});

Events.onClient("fieldguide:save", (player, snapshot) => {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.collections)) return;
  saveFieldGuide(player, snapshot);
});

Events.onClient("fieldguide:restored", (player, result) => {
  if (result?.needsTravel !== true || player.location()?.areaId !== "Overland") return;
  const { x, y, z } = player.position;
  player.travelToMap("/Game/Levels/Overland/Overland", { position: { x, y, z } });
});
```

`loadFieldGuide` and `saveFieldGuide` stand for your own store, keyed by the player's character. Three things the samples guard against:

- A joining player's Field Guide is fresh until the restore runs, so saving before then would overwrite their progress with an empty one.
- The client restores only a snapshot it was given. A player with nothing saved yet keeps the Field Guide they joined with, since `restore` without a snapshot resets it.
- The server cannot ask for a snapshot as the player leaves, so the client saves as changes happen.

A snapshot is large: it lists every collection item the game has, collected or not.

### What a snapshot holds

| Part | What it holds |
| --- | --- |
| `version` | Always 1 |
| `collections` | Every collection item and its state |
| `challenges` | Every challenge record: the Challenges tiers, homework and the game's acknowledgement records |
| `locks` | The challenge locks, ids starting `FGC_`: what each tier needs before it opens, and what a finished tier opens |
| `pages` | What keeps a collected page collected in the world, whether it came from a Revelio spot, a flying book, a moth frame, a Leviosa statue or an Incendio brazier: the spots already investigated, the pages' map beacons and the puzzle pages' keys |

The game's platform trophy records, whose ids start `PFA_`, are left out, and a restore never touches them.

### What a restore does

`restore` replaces the character's collections, challenges, challenge locks and page state with the snapshot's, the way the game loads a save. Nothing is collected, counted, paid or granted again: the player earns no experience, and neither Field Guide event fires. Unclaimed rewards come back unclaimed.

A restore is absolute. Whatever the snapshot leaves out goes back to the game's default, including anything the player collected before the restore ran. `FieldGuide.restore(null)` resets the character to a fresh Field Guide, and so does a call with no snapshot or `undefined`, so check you have one before you call it.

It returns what it did:

| Field | Meaning |
| --- | --- |
| `ok` | The snapshot was written, reloaded and read back unchanged |
| `reason` | Why the snapshot was refused or a write failed |
| `mismatches` | Up to 50 differences between the snapshot and what was read back |
| `needsTravel` | The player's world was already loaded. See below |

A refused snapshot changes nothing. `restore` refuses one with a `version` other than 1, a list of more than 10000 entries, an empty or malformed id, a state other than the three, a `PFA_` challenge, a negative count, a lock outside `FGC_`, or a page entry whose id is not one of the pages'. Before `ready()`, or on a game build that lacks what a restore needs, the `reason` is `"unavailable"`. Any other value that is not an object throws a `TypeError`.

### When the player is already in the world

The Field Guide itself takes a restore at once. The world does not: a page and its map icon read their state only as their part of the world loads. When the player was already in the world, `needsTravel` is `true`, and the pages around them keep showing the state from before the restore until their part of the world loads again.

Restore as early as `ready()` allows. When `needsTravel` comes back `true`, travel the player to load the world again. The server sample above reloads Overland where they stand with [`travelToMap`](/guides/players/travel/#loading-another-map). A respawn reloads it too.

## Following progress

Two client events report progress as the player makes it:

| Event | When it fires |
| --- | --- |
| `fieldGuideCollectionChanged(item)` | The game writes a collection item's state: a page collected, a trait learned, a beast seen |
| `fieldGuideChallengeChanged(challenge)` | A challenge record changes: progress, a finished tier or a claimed reward. At most once per record per frame |

Neither fires for a restore. This client tells the server about each page as the player collects it:

```js
// client/main.js
Events.on("fieldGuideCollectionChanged", (item) => {
  if (item.category === "Exploration" && item.state === "Obtained") Events.emitServer("fieldguide:page", { id: item.id });
});
```

## What a client can claim

The Field Guide runs in the player's game, so a modified client can collect anything, and can send any snapshot to save. `restore` checks a snapshot's shape, not whether the player earned it. Treat snapshots and progress events as the player's own claim, like their level, and base nothing the server decides, such as rewards or access, on them. See [Authority](/guides/core-concepts/authority/).

## What it does not cover

A snapshot holds the Field Guide's collections and challenges, and nothing else from the player's game:

- Level, experience, spells and talents: see [Progression](/guides/players/progression/).
- Items and gear: see [Inventory](/guides/players/inventory/#saving-inventories).
- The beasts in the player's bag: see [Catching beasts](/guides/npcs-and-creatures/catching-beasts/#keeping-catches).
- The Floo flames they have lit: see [Floo flames](/guides/players/travel/#floo-flames).

## Where to go next

- [Progression](/guides/players/progression/) for the level, spells and talents a server also applies on every visit.
- [Keys and menus](/guides/user-interface/keys-and-menus/#the-games-own-menus) for keeping the Field Guide's collections and challenges pages shut.
- [Authority](/guides/core-concepts/authority/) for what the server can trust from a client.
