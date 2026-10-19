---
title: Hits and defeat
description: How a spell hit between players lands, what the server checks, how much it costs, how to change hits with a policy, what losing a fight does, and how spell cooldowns work in a fight.
sidebar:
  order: 475
---

A spell that hits another player passes through the server on its way. The attacker's game reports the hit, the server checks it and prices it, and the victim's game applies the damage.

## How a hit lands

1. The attacker's spell has to strike the victim's body, which only blocks spells from players it is hostile to.
2. The attacker's game reports the hit to the server.
3. The server drops it if the two are not [hostile](/guides/pvp/rules-and-relations/#how-a-relation-is-decided), the victim is invulnerable or has spawn protection, the spell is a curse while `curses` is off, or the attacker reports more than 12 hits a second.
4. The server prices the hit, runs the [policy](#the-policy-hook), and sends the hit to the victim's game.
5. The victim's game applies the damage and the spell's effect, and handles a [defeat](#defeat).

`pvpHit` fires on the server with the attacker's id, the victim's id, the spell and the damage, once the hit is sent. It may still not land, for example on a kneeling player, so count defeats with `pvpDefeat` rather than hits.

The server does not check how far apart the two are, whether the attacker could see the victim, or whether they even have the spell. A changed game can report any hit on a player it is hostile to, so cap what a hit can do with the policy.

## Damage

The server sets the damage of every hit itself, and ignores the attacker's game's own number. Each spell has a price from the game's own spell data:

| Spell | Damage |
| --- | --- |
| Stupefy | 3, or 23 heavy |
| Stinging | 5 |
| Descendo | 11 |
| Expelliarmus | 20 |
| Confringo, Fiendfyre | 25 |
| Expulso | 35 |
| Diffindo | 45 |
| Incendio | 50 |
| Crucio | 4 a second for 20 seconds |
| Avada Kedavra | Lethal |

Every other spell does no damage but still has its effect. `Pvp.setSpellDamage(spell, damage)` replaces a spell's price and `null` restores it. The price is then multiplied by the `damageScale` rule, the attacker's `player.damageGivenMultiplier` and the victim's `player.damageTakenMultiplier`, set with `setDamageGivenMultiplier` and `setDamageTakenMultiplier`. The Killing Curse stays lethal unless you set its price yourself.

## The policy hook

`Pvp.setPolicy(fn)` runs a function of yours for every hit the rules allow, before it is sent. It receives the hit: the attacker's and victim's ids, the spell, its `damage` and, when known, the victim's health as `victimHp` and `victimMax`. It returns:

- `false` to drop the hit;
- a number to replace the damage;
- `{ allow, damage, duration, minHp }` to change several things, where `minHp` is a health the hit cannot take the victim below;
- nothing to let the hit through as it is.

```js
// server/main.js
Pvp.setPolicy((hit) => {
  const attacker = PlayerManager.getAll().find((p) => p.id === hit.casterId);
  const victim = PlayerManager.getAll().find((p) => p.id === hit.victimId);
  if (!attacker || !victim) return false;
  const a = attacker.position;
  const v = victim.position;
  if (Math.hypot(a.x - v.x, a.y - v.y, a.z - v.z) > 6000) return false; // farther than 60 m
  return Math.min(hit.damage, 60);
});
```

A policy that throws drops the hit. There is one policy for the whole server and the last one set wins, so a resource that sets one should own it and clear it with `Pvp.setPolicy(null)` as it stops.

## Defeat

A hit that would take a player's health to 0 defeats them, the way the relation's `defeat` says:

- `"death"`: the game's own death. `playerDied` fires, and the player respawns as after any [death](/guides/players/join-and-spawn/#deaths-and-respawns). Once they are back up, they have spawn protection for `spawnProtectionSeconds`.
- `"kneel"`: the player drops to their knees for `kneelSeconds`, held at `kneelHp`, ignoring hits, and then gets up by themselves. `playerDowned` fires as they kneel and `playerDownedEnd` as they stand. Under a kneel relation, even the Killing Curse kneels.

`pvpDefeat` fires with the victim, the player who defeated them and `"death"` or `"kneel"`. It credits a player whose hit the server accepted in the last few seconds, so a defeat nobody caused raises nothing. A policy's `minHp` under a death relation keeps the victim alive without a defeat.

On the client, `localDowned` fires as the local player kneels and `localDownedEnd` as they get up.

### How long a kneel lasts

The `kneelSeconds` rule sets how long a kneel lasts, 4 seconds by default. `0` keeps the loser kneeling until a script calls `player.endKneel()`, which stands a kneeling player up at once, for example when a medic reaches them. `endKneel` returns `false` for a player who is not kneeling.

Either way, the player stands up at full health. To give them less, set it in `playerDownedEnd`:

```js
// server/main.js
Pvp.configure({ defeat: "kneel", kneelSeconds: 0 });

// A medic's /revive <name> stands a kneeling player up.
Events.on("chatCommand", (player, message, command, args) => {
  if (command !== "revive") return;
  const patient = PlayerManager.getAll().find((p) => p.nickname === args[0]);
  if (!patient?.endKneel()) player.sendChat(`${args[0] ?? "Nobody"} is not kneeling.`);
});

// Back up from a kneel or a respawn with a quarter of their health, not all of it.
Events.on("playerDownedEnd", (player) => player.setHealth(Math.round(player.maxHealth / 4)));
```

For about 0.6 seconds after a player stands up, the game refuses a new kneel, so a hit in that time that should kneel them is lost.

## Health recovery

Players get their health back by themselves, and every PvP hit pauses that for 10 seconds. `player.setHealthRecovery(false)` stops it until you set it back to `true`. Their game keeps it off through respawns and trips to other maps.

A trip to another map, such as through a dungeon door, gives the player a fresh body at full health. `player.setKeepHealthOnTravel(true)` carries their health over instead, and `player.getKeepHealthOnTravel()` reads it back. A respawn after a death still starts at full health, so set it in `playerDownedEnd` as above. Together they keep a player's health in your hands, as a roleplay server may want:

```js
// server/main.js
Events.on("playerConnect", (player) => {
  player.setHealthRecovery(false);
  player.setKeepHealthOnTravel(true);
});
```

## Spell cooldowns

Out of combat, the game recharges most spells in about a third of a second. Fighting enemies, it waits each spell's full cooldown. To the game, a fight between players is never combat, so HogwartsMP decides when a player is in a PvP fight:

- a player hostile to them is within 50 m, or
- they hit, or were hit by, a hostile player in the last `flagCombatLockSeconds`.

While a player is in a PvP fight, every spell they cast waits its full cooldown, as it would against enemies. A cooldown that started in a fight keeps its full length after the fight ends.

| Spell | In a PvP fight | Outside a fight |
| --- | --- | --- |
| Flipendo | 5 s | 0.33 s |
| Accio, Incendio, Levioso | 8 s | 0.33 s |
| Confringo, Depulso, Descendo, Expelliarmus, Glacius | 10 s | 0.33 s |
| Arresto Momentum, Diffindo, Expulso | 15 s | 0.33 s |
| Crucio | 20 s | 0.33 s |
| Avada Kedavra | 90 s | 90 s |

These are the game's base times, before any talent that shortens them. Stupefy, the basic cast, and Protego have no cooldown in the game at all, so nothing here limits them.

The `cooldowns` rule turns this off. `"full"`, the default, works as above; `"fast"` keeps the out-of-combat recharge in fights too, for quick, spell-heavy PvP:

```js
// server/main.js
Pvp.configure({ cooldowns: "fast" });
```

Each player's own game runs their cooldowns, so a changed game can ignore them. What the server limits is hits: 12 a second from any one attacker.

## Where to go next

- [Rules and relations](/guides/pvp/rules-and-relations/) for who may fight whom.
- [Duels and wand links](/guides/pvp/duels-and-wand-links/) for one-on-one fights.
