---
title: Rules and relations
description: Decide which players may fight each other with server-wide rules, pairs, PvP flags and teams, and read the relation between any two players.
sidebar:
  order: 470
---

The server decides which players may hurt each other. It combines four things: the rules for the whole server, pairs of players you set, each player's PvP flag and each player's team. The answer for two players is their relation, and every player's game applies it: spells pass through players who are not hostile, and only hostile players can be locked on to.

Out of the box nobody can hurt anybody. PvP starts when a script sets rules or pairs.

## The rules

`Pvp.configure(patch)` changes the rules you name and returns all of them; `Pvp.getRules()` reads them:

| Rule | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | The master switch. Off, nobody is hostile, pairs included. |
| `who` | `"none"` | Who is hostile without a pair: `"none"`, `"flagged"` (both flagged), `"teams"` (both on a team) or `"everyone"` |
| `friendlyFire` | `false` | Whether players on the same team may hurt each other |
| `aim` | `"lock"` | `"lock"` lets players lock on to hostile players; `"skillshot"` does not, though spells still hit |
| `defeat` | `"death"` | What losing does: the game's own `"death"`, or a `"kneel"` that the player gets up from |
| `curses` | `"on"` | `"off"` stops the Killing, Cruciatus and Imperius curses doing anything to players |
| `kneelHp` | 1 | The health at which a kneel defeat starts, and the health a kneeling player is held at |
| `kneelSeconds` | 4 | How long a [kneel](/guides/pvp/hits-and-defeat/#how-long-a-kneel-lasts) lasts; `0` keeps the player kneeling until `player.endKneel()` |
| `flagCombatLockSeconds` | 15 | How long after a hit, given or taken, a player who drops their flag stays flagged, and stays in a fight for [spell cooldowns](/guides/pvp/hits-and-defeat/#spell-cooldowns) |
| `spawnProtectionSeconds` | 5 | How long a player killed in PvP cannot be hurt once they are back up; their own hit ends it |
| `damageScale` | 1 | Multiplies every spell's [damage](/guides/pvp/hits-and-defeat/#damage) |
| `cooldowns` | `"full"` | `"full"` gives spells their whole [cooldown](/guides/pvp/hits-and-defeat/#spell-cooldowns) in a PvP fight; `"fast"` keeps the game's out-of-combat recharge |

```js
// server/main.js
Pvp.configure({ who: "everyone", aim: "skillshot", curses: "off" });
```

An unknown rule or a value of the wrong kind throws, and so does a negative number; nothing changes then. `pvpRulesChanged` fires with the rules whenever they change.

## How a relation is decided

For two players, in this order:

1. With `enabled` off, they are not hostile.
2. A pair that says whether they are hostile decides it.
3. Otherwise `who` decides: nobody, both flagged, both on a team, or everyone.
4. Two players on the same team are not hostile unless `friendlyFire` is on.

A pair's `aim` and `defeat`, when it sets them, replace the rules' for those two players.

`Pvp.relation(a, b)` returns the relation between two players, as `{ hostile, aim, defeat, reason }`. `reason` says what decided it, such as `"pair"`, `"sameTeam"`, `"notFlagged"` or `"rule"`. On a client, `Pvp.relation(playerId)` returns the local player's relation to another, and `pvpRelationChanged` fires as it changes.

Virtual worlds already keep players apart: players in different worlds cannot see each other, so they cannot hit each other.

## Pairs

`Pvp.setPair(a, b, options)` sets how two players relate, whatever the rules, with `hostile`, `aim` and `defeat`. Leave out a field to keep the rules' answer for it, and pass `null` to clear the pair:

```js
// server/main.js
function challenge(first, second) {
  if (!Pvp.setPair(first, second, { hostile: true, defeat: "kneel" })) {
    first.sendChat("No duel can start right now.");
  }
}
```

`setPair` returns `false` for a player who is not connected, a player paired with themselves, or a new pair when 32 already exist across the server. A pair lasts through deaths and ends when either player disconnects.

## Flags

With `who: "flagged"`, players who have turned PvP on can fight each other. `player.setPvpFlag(true)` flags a player and `player.getPvpFlag()` reads it. Dropping the flag within `flagCombatLockSeconds` of a hit is put off until that time is up: `setPvpFlag(false)` then returns how long is left as `pendingMs`, and `pvpFlagChanged` fires with the player and their flag when it changes.

```js
// server/main.js
Pvp.configure({ who: "flagged" });

Events.on("chatCommand", (player, message, command) => {
  if (command !== "pvp") return;
  const result = player.setPvpFlag(!player.getPvpFlag());
  if (result.pendingMs) player.sendChat(`You are still in combat. PvP turns off in ${Math.ceil(result.pendingMs / 1000)} s.`);
  else player.sendChat(result.flagged ? "PvP is on." : "PvP is off.");
});
```

## Teams

`player.setPvpTeam(name)` puts a player on a team, named by any string of up to 32 bytes, and `null` takes them off it. `player.getPvpTeam()` reads it. With `who: "teams"`, players on different teams are hostile and players without a team are hostile to nobody, which suits spectators.

```js
// server/main.js
function startTeamMatch(red, blue) {
  Pvp.configure({ who: "teams", friendlyFire: false });
  for (const player of red) player.setPvpTeam("red");
  for (const player of blue) player.setPvpTeam("blue");
}
```

## What lasts

The rules, the [policy](/guides/pvp/hits-and-defeat/#the-policy-hook) and spell damage belong to the server: they stay when your resource stops, and any resource can change them, so let one resource own them and set them back as it stops. Pairs end with either player's connection. Flags and teams belong to a player's connection, so a player who reconnects comes back unflagged and without a team.

## Where to go next

- [Hits and defeat](/guides/pvp/hits-and-defeat/) for how a hit lands, what it costs and what losing does.
- [Duels and wand links](/guides/pvp/duels-and-wand-links/) for one-on-one fights.
