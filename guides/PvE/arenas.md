---
title: Combat arenas
description: Run Overland's two combat arenas on the server so every player there fights the same five waves, follow each wave with events, and decide what the fight pays.
sidebar:
  order: 440
---

Overland has two combat arenas, the game's Combat Challenges: a walled ground where waves of enemies come at the player, five in a row. In single player a totem starts one. In HogwartsMP the server runs them: `Arenas.start` puts up the arena's walls for every player near it and spawns its waves as server [NPCs](/guides/npcs-and-creatures/npcs/), so everyone there fights the same enemies. The `Arenas` global starts and stops them on the server and reads them on the client.

## The arenas

There are two, and their ids are the game's own map location ids:

| Id | Centre (x, y, z) | Enemies | `reward` |
| --- | --- | --- | --- |
| `CombatChallenge_HogwartsNorth_HN_AH` | 410170, −610589, −87587 | Poachers and extortionists, venomous spiders and Inferi; the fifth wave brings an Acromantula | `Back_110_Legendary` |
| `CombatChallenge_HogwartsSouth_HS_BF` | 309330, −230926, −94641 | A lone armoured troll, then wolves, goblins, spiders and Dugbogs; the fifth wave brings goblin chieftains and two armoured trolls | `Outfit_097_Legendary` |

`Arenas.getAll()` lists both, and `Arenas.get(id)` returns one, or `null` for an unknown id; ids match exactly, case included. Each arena has:

| Field | Meaning |
| --- | --- |
| `id`, `x`, `y`, `z` | The arena and its centre |
| `radius` | How far from the centre a player counts as in it, in centimetres: 2800 for both |
| `waves` | How many waves it has: 5 for both |
| `reward` | The item the game grants for finishing it. HogwartsMP does not grant it; see [What arenas pay](#what-arenas-pay) |
| `state` | `"idle"`, `"starting"`, `"wave"`, `"intermission"` or `"completed"` |
| `wave` | The current wave, counting from 1, or 0 before the first |
| `killed`, `total` | How many of the current wave's enemies are dead, and how many it has, reinforcements included |
| `npcs` | Its live enemies, as [NPCs](/guides/npcs-and-creatures/npcs/) |
| `players` | The players in it, whether it is running or not |

Only an arena that is running has a wave, enemies and counts; an `"idle"` one reads 0 and an empty `npcs`.

## Starting an arena

Only your script starts an arena. Every player's game removes the totems that would start one, so a player cannot start an arena by themselves, and the game's own wave spawner never runs. This holds under every [encounter policy](/guides/encounters/encounter-policy/). The totem that enters the Dark Arts arena, a Deluxe Edition extra with a map of its own, goes too, and `Arenas` does not run that arena.

`Arenas.start(id)` returns `false` for an unknown id, an arena that is already running, or while arenas are [turned off](#turning-arenas-off). It does not check who is there: an arena started with nobody in it still announces its first wave, then ends as abandoned 20 seconds after it started. Start one when players stand in it, for example from a chat command:

```js
// server/main.js
Events.on("chatCommand", (player, message, command) => {
  if (command !== "arena") return;
  const arena = Arenas.getAll().find((a) => a.players.some((p) => p.id === player.id));
  if (!arena) return player.sendChat("Stand in a combat arena first.");
  if (arena.state !== "idle") return player.sendChat("This arena is already running.");
  player.sendChat(Arenas.start(arena.id) ? "The arena wakes. Get ready." : "The arena did not start.");
});
```

To bring players to an arena, [teleport](/guides/players/join-and-spawn/#teleporting) them a few metres from its centre: the centre itself can sit inside scenery, where a teleport fails.

## How an arena runs

An arena moves through its states in order:

| State | What happens |
| --- | --- |
| `"starting"` | Players within 150 m load the arena's walls, cover and platforms. The first wave is announced 5 seconds after `start`. |
| `"wave"` | A wave is announced, and 2 seconds later its enemies start to appear at the game's spawn points, some at once and the rest over the next few seconds. `total` is known from the announcement. |
| `"intermission"` | The wave's last enemy died. The next wave is announced 3.5 seconds later. |
| `"completed"` | The fifth wave is cleared. The arena stays up for 8 seconds, then ends. |

Waves 3 and 5 hold enemies back as reinforcements, as the game does: once a group's enemies are all out and few enough of them are still alive, the next group comes in. A wave is cleared when every enemy of it, reinforcements included, is dead. Each wave brings the same enemies every run; which spawn point each one takes is random.

Every enemy of an arena fights for the same team, as in the game. The game of the player in the arena nearest an enemy's spawn point runs that enemy from the start, and the fight works like any [fight with a server NPC](/guides/pve/fighting-npcs/). An enemy counts as dead once its NPC is dead or gone, so `npc.kill()` and `npc.destroy()` from a script count towards clearing a wave, though neither pays anyone.

### Who is in an arena

A player is in an arena while they are in Overland, in world 0, within `radius` of its centre across the ground and within `radius` above or below it. A player in another [virtual world](/guides/core-concepts/virtual-worlds/) never counts, and the arena's enemies are in world 0, so they do not see them. A player in the global world sees the fight but does not count either.

Only position counts. A player who falls in the arena still counts until they respawn somewhere else, and an automatic respawn takes them to their spawn point. To keep fallen players in the fight, hold their respawn and bring them back inside the arena; see [Deaths and respawns](/guides/players/join-and-spawn/#deaths-and-respawns).

### When an arena ends

| Reason | When |
| --- | --- |
| `"completed"` | 8 seconds after its fifth wave was cleared |
| `"abandoned"` | Nobody has been in it for 20 seconds, in any state |
| `"stopped"` | `Arenas.stop(id)` ended it |
| `"disabled"` | `Arenas.setEnabled(false)` ended it |

An ending despawns every enemy still alive, returns the arena to `"idle"`, and takes its walls down on every player's game. It can be started again straight away. `Arenas.stop(id)` ends a running arena at once and returns `false` when it is not running.

## Turning arenas off

| Call | Does |
| --- | --- |
| `Arenas.enabled` | Whether arenas can run; `true` by default |
| `Arenas.setEnabled(false)` | Ends every running arena, within a quarter of a second, and makes `start` return `false`; camps and world events carry on |
| `Arenas.setEnabled(true)` | Lets arenas start again; it restarts none of them |

Off or on, the game's own arenas never run: off means players have no arenas at all. Anything but a boolean throws a `TypeError`.

Arenas, their settings and their reward policy belong to the server, not your resource. A running arena keeps running, and the settings stay, when the resource that set them stops.

## Arena events

| Event | Fires |
| --- | --- |
| `arenaStarted(arenaId)` | An arena started |
| `arenaWaveStarted(arenaId, wave)` | A wave was announced; its enemies appear 2 seconds later. `wave` counts from 1 |
| `arenaWaveCleared(arenaId, wave)` | Every enemy of the wave, reinforcements included, is dead |
| `arenaCompleted(arenaId, players)` | The fifth wave was cleared; `players` are the players in the arena at that moment |
| `arenaEnded(arenaId, reason)` | The arena ended and its enemies are gone; `reason` is one of the [reasons above](#when-an-arena-ends) |

A full run raises `arenaStarted`, then `arenaWaveStarted` and `arenaWaveCleared` for each wave from 1 to 5, then `arenaCompleted` straight after the fifth `arenaWaveCleared`, and `arenaEnded` with `"completed"` 8 seconds later. An arena that is stopped, abandoned or turned off before its fifth wave is cleared raises `arenaEnded` with that reason, and no `arenaCompleted`.

The events fire on the server's next update, after the call that caused them has returned. `Arenas.get` already reads `"starting"` right after `start` and `"idle"` right after `stop`.

The game shows no wave counter or banner for a server-run arena, so tell players yourself. This announces each wave to the players in the arena:

```js
// server/main.js
function tell(arenaId, text) {
  for (const player of Arenas.get(arenaId)?.players ?? []) player.sendChat(text);
}

Events.on("arenaWaveStarted", (arenaId, wave) => {
  const arena = Arenas.get(arenaId);
  if (arena) tell(arenaId, `Wave ${wave} of ${arena.waves}: ${arena.total} enemies.`);
});

Events.on("arenaWaveCleared", (arenaId, wave) => tell(arenaId, `Wave ${wave} cleared.`));

Events.on("arenaEnded", (arenaId, reason) => {
  if (reason === "stopped" || reason === "disabled") tell(arenaId, "The arena was closed.");
});
```

## What arenas pay

Arena enemies pay out like any NPC, by [reward policy](/guides/pve/rewards-and-loot/). By default the player who kills one earns the game's own kill reward and loot bag.

`Arenas.setRewardPolicy(policy)` sets what every arena enemy pays, in both arenas. It takes the same fields as an NPC's policy, with the same limits, and throws for a malformed one:

| Field | Default | Meaning |
| --- | --- | --- |
| `recipients` | `"killer"` | `"killer"`, `"damagers"` or `"nearby"` |
| `radius` | 3000 | For `"nearby"`, in centimetres, from 100 to 50000 |
| `gameReward` | `true` | Whether to pay the game's own kill reward |
| `experience` | 0 | Flat experience on top, a whole number up to 1,000,000 |
| `loot` | `null` | Up to 32 items, each an `itemId`, a `count` or `[min, max]` range, and a `chance`; `null` leaves the game's own loot bag |
| `lootMode` | `"each"` | `"each"` or `"shared"` |
| `lootDelivery` | `"drop"` | `"drop"` or `"inventory"` |

[Rewards and loot](/guides/pve/rewards-and-loot/#reward-policies) explains each field. What differs from the other policies:

- There is one policy for both arenas, as for [world events](/guides/encounters/world-events/#what-world-events-pay); [camps](/guides/encounters/camps/#what-camps-pay) can have one each.
- Fields it leaves out come from `NPC.setDefaultRewardPolicy`, never from the camps' or world events' policies. `null` clears it.
- It is written into every live arena enemy and every one spawned after, like a camp's. Setting it replaces a policy you set on one enemy with `npc.setRewardPolicy`, and setting one on an enemy afterwards replaces the arena's for that enemy.
- `Arenas.getRewardPolicy()` reads it back with the server default and built-in values filled in, so it never returns `null`.

Finishing an arena pays nothing by itself. The game's prize for it is the Legendary named in the arena's `reward`, and HogwartsMP removes the wave spawner that would grant it. `arenaCompleted` names the players who were there at the end, so give them what you like. Here every enemy pays everyone in the arena, and finishing grants the Legendary to those who do not have it yet:

```js
// server/main.js
Arenas.setRewardPolicy({ recipients: "nearby", radius: 6000, experience: 100 });

Events.on("arenaCompleted", (arenaId, players) => {
  const arena = Arenas.get(arenaId);
  if (!arena) return;
  for (const player of players) {
    if (player.inventory.has(arena.reward)) {
      player.sendChat("Arena cleared.");
      continue;
    }
    player.inventory.give(arena.reward, 1, {}, (error) => {
      if (error) console.warn(`could not give ${arena.reward}: ${error.code}`);
      else player.sendChat("Arena cleared. You earned its Legendary.");
    });
  }
});
```

A radius of 6000 reaches across the whole arena, which is 56 m wide. The Legendary arrives as gear [given](/guides/players/inventory/#changing) by the server, with no roll unless you pass [`stats`](/guides/players/inventory/#gear-stats).

## On the client

`Arenas.getAll()` on the client lists both arenas as this player's game knows them:

| Field | Meaning |
| --- | --- |
| `id`, `x`, `y`, `z`, `radius`, `waves` | As on the server |
| `state`, `wave`, `killed`, `total` | The arena's state as the server last sent it |
| `loaded` | Whether this game shows the arena's walls |

It has no `npcs`, `players` or `reward`. A client that is not sent a running arena, because the player is in another virtual world, reads it as `"idle"`.

A player's game loads a running arena's walls, cover and platforms once the player is in Overland within 150 m of its centre across the ground, and lets them go past 200 m or when the arena ends. It removes the arena's own wave spawner, so the only enemies are the server's. It also removes the arena's kill volumes, which would otherwise hurt anyone standing in them, players watching from outside the walls included.

This shows the current wave's progress in the player's own chat while they stand in a running arena:

```js
// client/main.js
let last = "";

setInterval(() => {
  const here = LocalPlayer.getPosition();
  if (!here) return;
  const arena = Arenas.getAll().find((a) => a.state === "wave" && Math.hypot(here.x - a.x, here.y - a.y) <= a.radius);
  const line = arena ? `Wave ${arena.wave} of ${arena.waves}: ${arena.killed} of ${arena.total} down` : "";
  if (line && line !== last) Game.notify(line);
  last = line;
}, 1000);
```

## Where to go next

- [Rewards and loot](/guides/pve/rewards-and-loot/) for what each enemy's death pays.
- [Fighting NPCs](/guides/pve/fighting-npcs/) for how players fight server NPCs together.
- [World events](/guides/encounters/world-events/) for the roaming encounters the server runs.
