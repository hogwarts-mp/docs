---
title: World events
description: How the server runs Overland's roaming encounters when players come near, cools each spot down, and lets you start or reset one yourself.
sidebar:
  order: 460
---

World events are the game's roaming encounters: a pack of wolves, a band of dark wizards, a troll. Under the [`"server"` encounter policy](/guides/encounters/encounter-policy/), the server runs them once, at more than 500 spots across Overland, so every player meets the same one. The `WorldEvents` global reads and controls them.

## How a spot runs

A spot rolls when a player in world 0 comes within 100 m. Each kind of encounter the spot can run has a 60% chance, and at most three events of one kind run at once across the whole server. When the roll succeeds the enemies spawn around the spot; when it fails, the spot waits until everyone has gone before it can roll again.

An event ends once every player is more than 140 m away. The spot then cools down for `WorldEvents.cooldownHours` of in-game time, 24 by default: at the default time scale, 24 real minutes. Moving the clock forward with `World.setTime` counts towards a cooldown, moving it back does not, and a time scale of 0 freezes every cooldown.

Some spots only roll by day or by night on the server's clock.

## Reading spots

`WorldEvents.getAll()` lists every spot, and `WorldEvents.get(id)` returns one or `null`:

| Field | Meaning |
| --- | --- |
| `id`, `x`, `y`, `z` | The spot and where it is |
| `kinds` | The encounters it can run, such as `"WE_ENEMY_ENCOUNTER_TROLL"`; kinds ending in `_EVE` set two sides against each other |
| `activeFrom`, `activeTo` | The hours it may roll |
| `streamOutRadius` | How far away players must be for its event to end, in centimetres |
| `state` | `"waiting"`, `"failed"`, `"active"` or `"cooldown"` |
| `kind` | The running or last kind, or `null` |
| `cleared` | Whether its last event was beaten |
| `cooldownSeconds` | In-game seconds of cooldown left |
| `npcs` | Its live enemies, as [NPCs](/guides/npcs-and-creatures/npcs/) |

## Controlling world events

| Call | Does |
| --- | --- |
| `WorldEvents.start(id, kind)` | Starts an event at a spot now, whatever its roll, cooldown, hours or the limit of three; leave out `kind` for a random one of the spot's kinds |
| `WorldEvents.reset(id)` | Ends a spot's event and clears its cooldown |
| `WorldEvents.setCooldownHours(hours)` | Sets the cooldown, from 0 to 720 in-game hours, for events that end from now on |
| `WorldEvents.setEnabled(false)` | Ends every running event and turns world events off; camps carry on |

`start` returns `false` for an unknown spot or kind, a spot that is already running, when the policy is not `"server"` or world events are off, and for half a second after either is turned on. An event started with nobody within 140 m ends straight away, so start events near players:

```js
// server/main.js
Events.on("chatCommand", (player, message, command) => {
  if (command !== "troll") return;
  const kind = "WE_ENEMY_ENCOUNTER_TROLL";
  const here = player.position;
  const distance = (spot) => Math.hypot(spot.x - here.x, spot.y - here.y);
  const spot = WorldEvents.getAll()
    .filter((s) => s.kinds.includes(kind) && s.state !== "active" && distance(s) < s.streamOutRadius)
    .sort((a, b) => distance(a) - distance(b))[0];
  if (!spot) return player.sendChat("No troll can appear near here.");
  player.sendChat(WorldEvents.start(spot.id, kind) ? "A troll approaches." : "The troll did not come.");
});
```

## World event events

`worldEventStarted` fires with the spot's id and the kind, `worldEventCleared` with the spot's id when every enemy of a running event is dead, and `worldEventEnded` with the spot's id when its event ends. `worldEventEnded` also fires for every running event when you reset its spot, turn world events off or leave the `"server"` policy.

Some spots roll an event with no enemies. It still raises `worldEventStarted`, but never `worldEventCleared`, so check its `npcs` first:

```js
// server/main.js
Events.on("worldEventStarted", (spotId, kind) => {
  const spot = WorldEvents.get(spotId);
  if (!spot || spot.npcs.length === 0) return;
  const foe = kind.replace("WE_ENEMY_ENCOUNTER_", "").replace(/_EVE$/, "").toLowerCase();
  for (const player of PlayerManager.getAll()) {
    const pos = player.position;
    if (player.virtualWorld === 0 && Math.hypot(pos.x - spot.x, pos.y - spot.y) < 30000) player.sendChat(`Something stirs nearby: ${foe}.`);
  }
});
```

## What world events pay

`WorldEvents.setRewardPolicy(policy)` sets what every world event's enemies pay, falling back to `NPC.setDefaultRewardPolicy`, and `WorldEvents.getRewardPolicy()` reads it back. There is one policy for all of them.

```js
// server/main.js
WorldEvents.setRewardPolicy({ recipients: "nearby", radius: 5000 });
```

These settings belong to the server, not your resource, and stay when it stops.

## Where to go next

- [Camps](/guides/encounters/camps/) for the enemy camps.
- [Zones](/guides/encounters/zones/) for areas of your own that notice who comes and goes.
