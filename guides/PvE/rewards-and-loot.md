---
title: Rewards and loot
description: Decide what an NPC's death pays and to whom, with reward policies for one NPC, for camps, for world events and for every NPC.
sidebar:
  order: 435
---

The server decides what a server NPC's death pays. By default, the player who kills it earns the game's own kill reward: Field Guide knowledge, experience and kill-challenge progress, and the game's own loot bag. A reward policy changes what is paid and to whom.

## Reward policies

```js
// server/main.js
NPC.setDefaultRewardPolicy({ recipients: "damagers", experience: 50 });

grunt?.setRewardPolicy({
  loot: [{ itemId: "LacewingFlies", count: [1, 3], chance: 0.5 }],
  lootDelivery: "inventory",
});
```

| Field | Default | Meaning |
| --- | --- | --- |
| `recipients` | `"killer"` | `"killer"`, `"damagers"` (everyone who hit it) or `"nearby"` (everyone who hit it, plus every player within `radius` of the body who can see it) |
| `radius` | 3000 | For `"nearby"`, in centimetres, from 100 to 50000 |
| `gameReward` | `true` | Whether to pay the game's own kill reward |
| `experience` | 0 | Flat experience on top, a whole number up to 1,000,000 |
| `loot` | `null` | Items to give, up to 32: each an `itemId`, a `count` or `[min, max]` range, and a `chance` from 0 to 1 |
| `lootMode` | `"each"` | `"each"`: every recipient gets a roll of their own. `"shared"`: one roll for the group. |
| `lootDelivery` | `"drop"` | `"drop"` leaves a loot bag at the body; `"inventory"` puts the loot straight into the recipient's [inventory](/guides/players/inventory/) |

`loot: null` leaves the game's own random loot bag, which each player's game drops for itself; what a player takes from it arrives as an [item the game hands out](/guides/players/inventory/#items-the-game-hands-out). `loot: []` drops nothing at all.

A malformed policy throws, and so does an item id the game does not know.

## Which policy applies

An NPC's own policy wins. Then, for a camp's enemies, that camp's policy and the policy for every camp; for a world event's, the world events' policy. Last comes `NPC.setDefaultRewardPolicy`, and the fields none of them set keep their defaults.

| Call | Sets |
| --- | --- |
| `npc.setRewardPolicy(policy)` | One NPC's policy; `npc.getRewardPolicy()` reads it back |
| `Camps.setRewardPolicy(policy, campId)` | One [camp](/guides/encounters/camps/#what-camps-pay)'s, or every camp's without `campId` |
| `WorldEvents.setRewardPolicy(policy)` | Every [world event](/guides/encounters/world-events/#what-world-events-pay)'s |
| `NPC.setDefaultRewardPolicy(policy)` | Every NPC's |

`setRewardPolicy` replaces a policy rather than merging into it: setting `{ experience: 5 }` on an NPC drops loot you set on it before. `null` clears one. A camp policy is written into each of its NPCs, so setting a camp's policy afterwards replaces one you set on its NPCs directly.

The policies for camps, world events and every NPC belong to the server, not your resource, and stay when it stops.

## When and how it pays

The server settles a death half a second after it, so a policy can still change until then. Each recipient's own game grants the kill reward and experience.

- **Drop delivery** leaves a loot bag at the body. With `"each"`, every recipient sees their own roll in it; with `"shared"`, the first recipient to loot it takes everything, and other players see it empty and locked. The bag goes once emptied, or after five minutes, and taking from it raises `lootableTaken` like any [lootable](/guides/world/loot/).
- **Inventory delivery** puts the loot in each recipient's inventory; with `"shared"`, one recipient chosen at random gets it.

A death from `npc.kill()` pays nobody. An NPC finished off by its owner at low health pays the last player who hit it.

```js
// server/main.js
// A boss that pays everyone who was there.
const boss = NPC.create("Troll_Crate", x, y, z, "hostile");
boss?.setRewardPolicy({
  recipients: "nearby",
  radius: 5000,
  experience: 750,
  loot: [{ itemId: "TrollMucus", count: [2, 4] }],
  lootMode: "each",
});
```

## Where to go next

- [Fighting NPCs](/guides/pve/fighting-npcs/) for who counts as a killer and a damager.
- [Loot](/guides/world/loot/) for lootables of your own.
