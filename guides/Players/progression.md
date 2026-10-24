---
title: Progression
description: Set a player's level and experience, choose which spells they can cast, and give them talents, with every talent in the game.
sidebar:
  order: 340
---

A player's level, spells and talents live in their own game. A client script applies them through `Progression`, `Spells` and `Talents`, and the server decides what they should be. Don't count on the game keeping any of it between visits: store it on the server and apply it again on every `worldReady`.

The game runs on the player's machine, so a modified client can raise its own level or grant itself talents. Base anything the server decides, such as rewards or access, on the server's own records, not on what a client reports. See [Authority](/guides/core-concepts/authority/).

HMP Foundations ships [`hmp-progression`](https://github.com/hogwarts-mp/foundations/tree/main/resources/hmp-progression), which keeps each character's experience, talent points and talents in MySQL and applies them when the player joins. Use it, or build your own on the calls below.

## Levels and experience

The game stores experience points and works the level out from them, from level 1 to 40.

| Call | Does |
| --- | --- |
| `Progression.getLevel()` | The current level, or `-1` before the player is in the world |
| `Progression.getPoints()` | The current experience points, or `-1` before the player is in the world |
| `Progression.addExperience(points, source, detail)` | Adds experience the way the game does: the bar fills, and a level-up shows its banner and awards talent points |
| `Progression.setPoints(points, options)` | Sets the exact total, kept within the game's level curve. Unspent talent points stay as they are unless `options.preserveTalentPoints` is `false` |
| `Progression.getLevelBounds(level)` | The range of points a level covers, as `{ start, end }`, or `null` |

`Progression.setLevel(level)` has no effect in the current game build. To put a player at a level, set their points to the start of it:

```js
// server/main.js
const levels = new Map(); // player id -> level, loaded from your own storage

Events.on("worldReady", (player) => {
  player.emit("progression:level", JSON.stringify({ level: levels.get(player.id) ?? 1 }));
});
```

```js
// client/main.js
Events.on("progression:level", (data) => {
  const bounds = /** @type {{ start: number; end: number } | null} */ (Progression.getLevelBounds(data.level));
  if (bounds) Progression.setPoints(bounds.start);
});
```

`setPoints` returns what the game did: whether it was `accepted`, the `requested` points and the `target` they were kept to, whether they were `clamped`, whether anything `changed`, and the resulting `level`, `points` and `talentPoints`.

Experience the game pays out during play, including the kill experience of a [reward policy](/guides/pve/rewards-and-loot/), lands only in that player's game: the server is not told how much. To keep it, award it from the server as well, for example on `npcDied`, and add it to the total you store.

## Spells

A player can cast a spell only while its lock is open. `Spells.setPolicy(lockIds, bonusLoadouts, relockIds)` decides which are:

- `lockIds` are the spell locks to open. The client keeps them open, opening them again after travel.
- `bonusLoadouts`, from 0 to 3, is how many extra spell sets the player has. Those sets come from the Spell Knowledge I to III talents, and the policy grants or removes exactly that many of them. Leave it out to keep whatever the player has.
- `relockIds` closes locks again. Leaving an id out of `lockIds` does not close it, so put the spells you take away here: they are locked and cleared from the player's spell slots. `Spell_Stupefy` is Basic Cast, and relocking it takes Basic Cast away too.

Each call replaces the policy before it:

```js
// server/main.js
const STARTER_SPELLS = ["Spell_Protego", "Spell_Stupefy", "Spell_Levioso", "Spell_Accio", "Spell_Incendio"];

Events.on("worldReady", (player) => {
  player.emit("spells:policy", JSON.stringify({ unlocked: STARTER_SPELLS, spellSets: 1, revoked: [] }));
});
```

```js
// client/main.js
Events.on("spells:policy", (policy) => {
  Spells.setPolicy(policy.unlocked, policy.spellSets, policy.revoked);
});
```

A spell's lock is `Spell_` followed by the game's own name for it, which is not always the name players see:

| Spell | Lock |
| --- | --- |
| Accio | `Spell_Accio` |
| Alohomora I, II and III | `Spell_Alohomora`, `Spell_Alohomora_L2`, `Spell_Alohomora_L3` |
| Altering Spell | `Spell_Transformation` |
| Ancient Magic Throw | `Spell_Oppugno` |
| Arresto Momentum | `Spell_ArrestoMomentum` |
| Avada Kedavra | `Spell_AvadaKedavra` |
| Bombarda | `Spell_Expulso` |
| Confringo | `Spell_Confringo` |
| Conjuring Spell | `Spell_Conjuration` |
| Crucio | `Spell_Crucio` |
| Depulso | `Spell_Depulso` |
| Descendo | `Spell_Descendo` |
| Diffindo | `Spell_Diffindo` |
| Disillusionment | `Spell_Disillusionment` |
| Evanesco | `Spell_Vanishment` |
| Expelliarmus | `Spell_Expelliarmus` |
| Fiendfyre | `Spell_FiendFyre` |
| Flipendo | `Spell_Flipendo` |
| Glacius | `Spell_Glacius` |
| Imperio | `Spell_Imperius` |
| Incendio | `Spell_Incendio` |
| Levioso | `Spell_Levioso` |
| Lumos | `Spell_Lumos` |
| Petrificus Totalus | `Spell_Petrificus` |
| Protego | `Spell_Protego` |
| Reparo | `Spell_Reparo` |
| Revelio | `Spell_Revelio` |
| Basic Cast | `Spell_Stupefy` |
| Transformation | `Spell_TransformationOverland` |
| Wingardium Leviosa | `Spell_Wingardium` |

`Spells.setLoadoutSlot(slot, spellName)` puts an open spell in one of the four slots of the current spell set, and `Spells.loadout()` reads a set back. `spellName` is the lock without `Spell_`, such as `"Expulso"` for Bombarda.

A server can also define spells of its own, each with a lock of `Spell_` followed by its id. See [Custom spells](/guides/players/custom-spells/).

### Spell lessons

`SpellLearning.start(spell)` plays the game's lesson for a spell, one of `SpellLearning.supportedSpells()`. When it ends, the client raises `spellLearningFinished` with a `status` of `"completed"`, `"cancelled"` or `"failed"`. A lesson does not unlock anything, so open the spell yourself when it completes:

```js
// client/main.js
Events.on("spellLearningFinished", (result) => {
  if (result.status === "completed") Events.emitServer("spells:learned", { spell: result.spell });
});
```

The server then adds the spell's lock to the player's policy.

A resource can also add lessons of its own, from a stock lesson's look or a path it draws, with its own buttons and chaser. See [Lessons of your own](/guides/players/custom-spells/#lessons-of-your-own).

## Talents

Talents need the player in the world: `Talents.available()` is `false` until then. The calls that change a talent return whether the game did it, and the change takes effect at once.

| Call | Does |
| --- | --- |
| `Talents.purchase(id)` | Buys a talent the way the talent menu does: it costs a point and needs the talent's level, its lock and any earlier talent it builds on |
| `Talents.grant(id)` | Gives a talent for free, whatever its requirements |
| `Talents.upgrade(id)` | Buys the next level of a talent the player has |
| `Talents.setLevel(id, level)` | Sets the level of a talent the player has. Refused for one they don't |
| `Talents.remove(id)` | Takes a talent away without returning its point |
| `Talents.refund(id)` | Takes a talent away and returns its point |
| `Talents.reset(type)` | Refunds every talent, or every talent of one type such as `"Core"` |
| `Talents.getPoints()` | The unspent talent points, or `-1` before the player is in the world |
| `Talents.addPoints(amount)` | Adds to the unspent points; a negative amount takes them away |

To read a talent, `Talents.has(id)` says whether the player has it, `Talents.getLevel(id)` gives its level (`0` when they don't) and `Talents.getState(id)` gives `"unavailable"`, `"available"`, `"purchased"` or `"upgradeUnavailable"`, or `null` for an id the game doesn't know. `Talents.list(type)` returns every talent, or those of one type, with its live state:

| Field | Meaning |
| --- | --- |
| `id` | The talent's id, such as `Talent_Core_DodgeFast` |
| `type` | Its type: `Core`, `Spells`, `DarkWizard`, `Infiltrator`, `SancWheel`, `ChallengeReward` or `General` |
| `state`, `level` | As `getState` and `getLevel` |
| `maxLevel` | Its highest level |
| `levelRequirement` | The player level a purchase needs |
| `lockId`, `lockId2` | The locks a purchase needs, or `""` |
| `prerequisite` | The talent a purchase needs first, or `""` |
| `row`, `column` | Where it sits in the talent menu |

A server that hands out talents keeps the list itself and grants them on every `worldReady`. Granting one the player already has does nothing:

```js
// server/main.js
const talents = new Map(); // player id -> talent ids, loaded from your own storage

Events.on("worldReady", (player) => {
  player.emit("talents:grant", JSON.stringify({ ids: talents.get(player.id) ?? [] }));
});
```

```js
// client/main.js
function grantAll(ids) {
  if (!Talents.available()) {
    setTimeout(() => grantAll(ids), 500);
    return;
  }
  for (const id of ids) {
    if (!Talents.grant(id)) console.log(`The game refused talent ${id} (${Talents.getState(id)})`);
  }
}

Events.on("talents:grant", (data) => grantAll(data.ids));
```

For talents players earn, call `purchase` and report the result, so the server records only what the game accepted:

```js
// client/main.js
Events.on("talents:buy", (data) => {
  const ok = Talents.purchase(data.id);
  Events.emitServer("talents:bought", { id: data.id, ok, points: Talents.getPoints() });
});
```

### Requirements

In the [talent lists](#every-talent), **Level** is the player level `purchase` needs and **Needs** is the lock it needs. Open a `Spell_` lock with the [spell policy](#spells) and any other lock, such as a `SancWheel_` lock for a Room of Requirement potion or plant, with `Doors.setLock(lockId, true)`. `grant` needs neither.

Spell Knowledge I to III (`GEN_SpellLoadouts_1` to `GEN_SpellLoadouts_3`) add spell sets. A spell policy that sets `bonusLoadouts` owns those three: each time it applies, it puts them back to that count, whatever `Talents` did to them.

### When a talent seems to do nothing

- The ids are not the names in the talent menu, and a few mislead. `INF_Swift` is Human Demiguise, which lets a player sprint while Disillusioned. The dodge vanish named Swift is `Talent_Core_DodgeFast`. Look a talent up by its name in the lists below.
- Some work only in places. Swift does nothing inside Hogwarts castle.
- A talent works through a gameplay tag on the player. `Talents.abilityTags()` lists the tags and `Talents.hasAbilityTag(tag)` tests one; the tags a grant adds are that talent's. Tag names don't follow the ids: `Talent_Core_DodgeFast` adds `RPGAbility.Talent.Core.Talent_Core_DodgeFast` and `INF_Swift` adds `RPGAbility.INF.Swift`.

## Every talent

The talent menu has five trees. The effects are summaries; the menu has the game's own wording.

### Core

| Talent | Name | Effect | Level | Needs |
| --- | --- | --- | --- | --- |
| `Talent_Core_JinxCooldown` | Basic Cast Mastery | Basic Cast hits shorten spell cooldowns | 5 | |
| `Talent_Core_JinxAM` | Basic Cast Airborne Absorption | Basic Cast hits on airborne enemies fill more of the Ancient Magic meter | 16 | |
| `SKILL_FocusGain` | Protego Absorption | Protego blocks fill the Ancient Magic meter, perfect blocks more so | 5 | `Spell_Protego` |
| `DUEL_Deflect1` | Protego Expertise | A perfect Protego sends two projectiles back at enemies | 16 | `Spell_Protego` |
| `Talent_Core_ProtegoBlast` | Protego Mastery | A perfect Protego releases a blast that damages enemies and breaks their shields | 22 | |
| `Talent_Core_OppugnoQuick` | Ancient Magic Throw Expertise | Ancient Magic Throw catches disarmed enemies' weapons and throws them | 5 | `Spell_Oppugno` |
| `Talent_Core_RevelioUpgrade` | Revelio Mastery | Revelio reaches farther | 16 | |
| `Talent_Core_DodgeFast` | Swift | Holding Dodge makes the player vanish and reappear a short way off. Not inside Hogwarts castle | 5 | |
| `Talent_Core_DodgeAM` | Evasion Absorption | Dodging an unblockable attack fills the Ancient Magic meter | 16 | |
| `GEN_SpellLoadouts_1` | Spell Knowledge I | Adds a spell set | 5 | |
| `GEN_SpellLoadouts_2` | Spell Knowledge II | Adds a spell set | 5 | |
| `GEN_SpellLoadouts_3` | Spell Knowledge III | Adds a spell set | 16 | |
| `Talent_Core_StupefyStun` | Stupefy Mastery | Stupefy stuns for longer | 16 | |
| `Talent_Core_StupefyAOE` | Stupefy Expertise | Stupefy damages the enemy it hits | 22 | |
| `LOW_WoundCleaningUpgrade1` | Wiggenweld Potency I | Wiggenweld heals more | 5 | |
| `LOW_WoundCleaningUpgrade2` | Wiggenweld Potency II | Wiggenweld heals more again | 16 | |

### Spells

| Talent | Name | Effect | Level | Needs |
| --- | --- | --- | --- | --- |
| `Talent_Spell_Accio` | Accio Mastery | Accio also pulls in enemies near its target | 5 | `Spell_Accio` |
| `Talent_Spell_Confringo` | Confringo Mastery | Confringo hits throw off fiery bolts that seek other enemies | 5 | `Spell_Confringo` |
| `Talent_Spell_Depulso` | Depulso Mastery | Depulso also blasts the area around the player | 5 | `Spell_Depulso` |
| `Talent_Spell_Diffindo` | Diffindo Mastery | Diffindo cuts through its target to hit others | 5 | `Spell_Diffindo` |
| `Talent_Spell_Incendio` | Incendio Mastery | Incendio also puts a ring of fire around the player | 5 | `Spell_Incendio` |
| `Talent_Spell_Levioso` | Levioso Mastery | Levioso also lifts enemies near its target | 5 | `Spell_Levioso` |
| `Talent_Spell_Bombarda` | Bombarda Mastery | Bombarda's explosion covers a much larger area | 16 | `Spell_Expulso` |
| `Talent_Spell_Descendo` | Descendo Mastery | A Descendo slam sends a damaging shockwave around its target | 16 | `Spell_Descendo` |
| `Talent_Spell_Glacius` | Glacius Mastery | Hitting a frozen enemy blasts damaging shards around it | 16 | `Spell_Glacius` |
| `Talent_Spell_Transformation` | Transformation Mastery | Enemies hit by the Transformation Spell turn into explosive objects | 22 | `Spell_TransformationOverland` |

### Dark Arts

Cursed enemies take more damage.

| Talent | Name | Effect | Level | Needs |
| --- | --- | --- | --- | --- |
| `Talent_Curse_CurseStupefy` | Stunning Curse | Stupefy curses its target | 5 | |
| `Talent_Spell_Expelliarmus` | Disarming Curse | Expelliarmus curses its target | 5 | `Spell_Expelliarmus` |
| `Talent_Spell_Flippendo` | Knockback Curse | Flipendo curses its target | 5 | `Spell_Flipendo` |
| `DAC_CurseReflect1` | Blood Curse | Damaging one cursed enemy damages every cursed enemy | 5 | |
| `Talent_Spell_Arresto` | Slowing Curse | Arresto Momentum curses its target | 16 | `Spell_ArrestoMomentum` |
| `Talent_Curse_Crucio` | Crucio Mastery | Hitting an enemy cursed with Crucio sends a projectile that curses another enemy nearby | 16 | `Spell_Crucio` |
| `Talent_Curse_Imperio` | Imperio Mastery | An enemy under Imperio curses what it hits | 16 | `Spell_Imperius` |
| `Talent_Curse_CurseLong` | Enduring Curse | Curses last longer | 16 | |
| `Talent_Curse_AvadaKedavra` | Avada Kedavra Mastery | Killing an enemy with Avada Kedavra kills every cursed enemy | 22 | `Spell_AvadaKedavra` |
| `Talent_Curse_CurseHealth` | Curse Sapper | Defeating a cursed enemy restores some health | 22 | |

### Stealth

| Talent | Name | Effect | Level | Needs |
| --- | --- | --- | --- | --- |
| `INF_Swift` | Human Demiguise | The player can sprint while Disillusioned | 5 | `Spell_Disillusionment` |
| `Talent_Infil_Evasion1` | Sense of Secrecy I | Enemies detect the player less easily | 5 | `Spell_Disillusionment` |
| `Talent_Infil_Evasion2` | Sense of Secrecy II | Enemies detect the player less easily again | 16 | |
| `Talent_Infil_PetrificusTotalus` | Petrificus Totalus Mastery | Petrificus Totalus also affects enemies nearby | 22 | |

### Room of Requirement

| Talent | Name | Effect | Level | Needs |
| --- | --- | --- | --- | --- |
| `Talent_Sanc_Cabbage` | Fertiliser | Each Chinese Chomping Cabbage thrown releases a second one for free | 5 | `SancWheel_ChompingCabbage_Byproduct` |
| `Talent_Sanc_EdurusPotion` | Edurus Potion Potency | Edurus Potion also makes the player invulnerable and sends projectiles back | 5 | `SancWheel_Edurus` |
| `Talent_Sanc_InvisibilityPotion` | Invisibility Potion Potency | Invisibility Potion lasts longer | 5 | `SancWheel_InvisibilityPotion` |
| `Talent_Sanc_Mandrake` | Headache | Mandrakes incapacitate for longer and deal more damage | 16 | `SancWheel_Mandrake_Byproduct` |
| `Talent_Sanc_MaximaPotion` | Maxima Potion Potency | Maxima Potion adds more damage and breaks enemy shields | 16 | `SancWheel_Maxima` |
| `Talent_Sanc_AMPotion` | Focus Potion Potency | Casting spells from the spell set while Focus Potion is active makes it last longer | 22 | `SancWheel_AMFillPotion` |
| `Talent_Sanc_AutoDamagePotion` | Thunderbrew Potency | Thunderbrew reaches much farther and deals much more damage | 22 | `SancWheel_AutoDamagePotion` |
| `Talent_Sanc_Venomous` | Noxious | Venomous Tentacula deals more damage and breaks shields | 22 | `SancWheel_VenomousTentacula_Byproduct` |

### Outside the menu

These are talents to the game but belong to none of the five trees. Their level requirement is 0.

| Talent | Type | Name | Effect |
| --- | --- | --- | --- |
| `GEN_Inventory_1` to `GEN_Inventory_4` | `ChallengeReward` | Storage Expansion I to IV | Five more backpack slots each |
| `SKILL_AMUpgrade1`, `SKILL_AMUpgrade2` | `ChallengeReward` | Ancient Magic Mastery | A larger Ancient Magic meter |
| `SKILL_AMUpgrade3` | `ChallengeReward` | None in the game's text | |
| `SKILL_Stupefy1` | `General` | None in the game's text | |

## Where to go next

- [Events](/guides/core-concepts/events/) for `worldReady` and sending data between the server and clients.
- [Rewards and loot](/guides/pve/rewards-and-loot/) for what defeating an NPC pays.
- [Inventory](/guides/players/inventory/) for items, which a server also keeps between visits itself.
