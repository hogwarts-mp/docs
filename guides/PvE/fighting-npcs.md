---
title: Fighting NPCs
description: How several players fight one NPC together, what the server decides and what clients report, damage and death events, damage multipliers, and bosses.
sidebar:
  order: 430
---

Any number of players can fight the same [NPC](/guides/npcs-and-creatures/npcs/). Each sees it attack them and can hurt it, the NPC keeps one health bar, and its death credits the players who fought it.

## How a fight works

One player's game, the NPC's owner, runs the NPC's AI and the game's own combat code. Every other player sees a copy that follows the owner's.

- **The NPC attacking another player:** its swing, spell or thrown weapon is passed through the server to the player it targets. That player's own game works out the hit from its copy of the NPC, so damage depends on the victim's level, gear and multipliers. No damage number travels between players.
- **Another player hurting the NPC:** their game measures the damage it did to its copy and reports it to the server, which passes it to the owner to apply. Shield breaks, killing blows, status effects and hit reactions travel the same way, and everyone sees the NPC's real health on its health bar.
- **The owner changing mid-fight:** the new owner takes over where the old one left off. The NPC keeps its health, its fight, a raised shield and running effects.

The server checks that relayed attacks come from the NPC's owner and caps how many arrive. It drops NPC hits on players who are invulnerable.

## Damage and death

`npcDamaged` fires with the NPC's id, the attacking player's id and the amount, for every hit any player lands, the owner's player included. `npcDied` fires with the NPC's id, its enemy id, the id of the player who killed it, or `null`, and the ids of every player who damaged it:

```js
// server/main.js
function onlinePlayer(id) {
  return PlayerManager.getAll().find((player) => player.id === id);
}

Events.on("npcDied", (npcId, enemyId, killerId, damagerIds) => {
  const killer = killerId === null ? undefined : onlinePlayer(killerId);
  if (killer) killer.sendChat(`You defeated ${enemyId}.`);
  for (const id of damagerIds) {
    if (id !== killerId) onlinePlayer(id)?.sendChat(`You helped defeat ${enemyId}.`);
  }
});
```

- The killer is the last player to damage the NPC within 15 seconds of its death.
- `npcDied` arrives half a second after the death; the NPC's handle still works in the handler, with `alive` false. `npc.kill()` raises it with no killer, and `npc.destroy()` raises nothing.
- The ids are network ids. A player may have left by the time you read one, so look them up among the online players.

These are reports from players' games. `npcDamaged` amounts are what the attacker's game measured, capped at 10,000 a hit and 20,000 a second per player, and can be more than the NPC actually lost. Health and death come from the owner's game. A changed game can claim damage it did not do, so be careful what you hang on them.

## Damage multipliers

Both sides of a fight between a player and a server NPC have multipliers, set on the server:

| Call | Scales |
| --- | --- |
| `npc.setDamageGivenMultiplier(n)` | The damage the NPC deals to players |
| `npc.setDamageTakenMultiplier(n)` | The damage players deal to the NPC |
| `player.setDamageGivenMultiplier(n)` | The damage the player deals, to NPCs and in [PvP](/guides/pvp/hits-and-defeat/#damage) |
| `player.setDamageTakenMultiplier(n)` | The damage the player takes from NPCs and in PvP |

The final damage is the attacker's given multiplier times the victim's taken multiplier, on top of the game's own gear, potions and difficulty. `null` restores 1, and a negative value throws. `damageGivenMultiplier` and `damageTakenMultiplier` read them back.

An NPC's multipliers carry over hand-offs and travel. A player's last until they reconnect. They do not touch fights between NPCs, falls, or enemies a player's own game spawns under the [`"native"` encounter policy](/guides/encounters/encounter-policy/).

```js
// server/main.js
// An escort nobody can hurt, whose quest fails if it dies some other way.
const escort = NPC.create("Goblin_Grunt", x, y, z, "friendly");
escort?.setDamageTakenMultiplier(0);
escort?.setMaxHealth(4000);
```

## Health

Server NPCs never get their health back by themselves, and the owner finishes off any NPC at or below 12% of its max health. Players do get theirs back; [Health recovery](/guides/pvp/hits-and-defeat/#health-recovery) covers turning that off for a hardcore mode.

## Bosses

Bosses keep the game's health phases. A troll such as `Troll_Crate` stops taking damage at two thirds and one third of its health for a moment, as in single player, before the fight goes on. `npc.kill()` always lands, phases or not.

## Where to go next

- [Rewards and loot](/guides/pve/rewards-and-loot/) for what an NPC's death pays.
- [NPCs](/guides/npcs-and-creatures/npcs/) for spawning NPCs and switching their behaviour off.
