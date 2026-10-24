---
title: Custom spells
description: Define spells of your own on top of the game's, give them to players, react to their casts, price them and modded spells in PvP, and add spell lessons of your own.
sidebar:
  order: 345
---

A server can add spells to the game. A defined spell runs one of the game's player spells for its look and behaviour, with its own name, icon, numbers and lock, and can take parts from other spells: a Confringo that freezes what it hits, or a silent Depulso whose cast summons a Patronus. No mod is needed. Every player's game adds the spell to its own spell table, then casts it, cools it down and shows it to other players like any other spell.

On the server, `Spells` defines spells. On a client, `Spells` is the [spell policy and spell bar](/guides/players/progression/#spells), and `SpellLearning` runs spell lessons, including [lessons of your own](#lessons-of-your-own).

## Defining a spell

```jsx
// server/main.js
Spells.define({
  id: "Firestorm",
  base: "Confringo",
  name: "Firestorm",
  description: "A searing bolt that sets what it hits ablaze.",
  icon: "my-spells/img/firestorm.png",
  incantation: "Incendio",
  stats: { damage: 40, cooldown: 6, range: 2500, projectileSpeed: 6000 },
});
```

`Spells.define(definition)` adds the spell to every player's game, now and for everyone who joins later. Defining the same id again replaces that spell for everyone, live. It throws for anything it can't use, and returns the definition as the server keeps it.

| Field | Meaning |
| --- | --- |
| `id` | The spell's id: 3 to 32 characters, a letter, then letters, digits or `_`. It can't be one of the game's spells |
| `base` | The game's player spell it runs: its projectile, effects and cast |
| `name` | The title the spell menu and spell bar show, at most 48 bytes. The id by default |
| `description` | The spell menu's text about it, at most 300 bytes |
| `icon` | A PNG for its symbol; see [Icons](#icons). The base's symbol by default |
| `incantation` | Another player spell whose line the caster says, or `"none"` for a silent cast. The base's line by default |
| `stats` | Numbers that replace the base's; see [Stats](#stats) |
| `parts` | Parts taken from other player spells; see [Parts](#parts) |

`name` and `description` can't hold `<`, `>`, `{` or `}`. The game finds a spell's title by its id, so an id the game already uses for some text of its own shows that text instead of `name`. If your name doesn't show, pick a more distinctive id.

`base`, `incantation` and each part name a player spell the way the game's spell records do, ignoring case. For most spells that is the lock in the [spell table](/guides/players/progression/#spells) without `Spell_`: `"Confringo"`, `"Glacius"`, or `"Expulso"` for Bombarda. Pick a base that goes on the spell bar. A spell with a key of its own, such as Revelio, Lumos or Protego, or with none, such as Episkey, can't be slotted.

### Stats

| Stat | Meaning | Range |
| --- | --- | --- |
| `damage` | The damage a hit deals; per second for a spell that burns, such as Crucio | 0 to 100,000 |
| `objectDamage` | The damage a hit deals to objects | 0 to 100,000 |
| `cooldown` | Seconds before it can be cast again | 0 to 3,600 |
| `range` | How far it reaches, in centimetres | 0 to 50,000 |
| `projectileSpeed` | How fast its projectile flies | 0 to 100,000 |
| `projectileGravity` | The gravity on its projectile | -100,000 to 100,000 |
| `duration` | How long its effect holds a character it hits, in seconds | 0 to 3,600 |
| `playerDuration` | How long its effect holds a player it hits, in seconds | 0 to 3,600 |
| `chargeTime` | Its charge time | 0 to 60 |
| `impulse` | How hard it pushes what it hits | 0 to 1,000,000 |

A stat left out, or `null`, keeps the base's value, and a value out of range is clamped. An unknown stat throws. Like every spell's, a defined spell's `cooldown` only runs in full in a fight: outside one, the game recharges spells far faster. See [Spell cooldowns](/guides/pvp/hits-and-defeat/#spell-cooldowns).

### Parts

`parts` takes pieces of other player spells, each named like `base`. A part left out stays the base's.

| Part | What it takes |
| --- | --- |
| `projectile` | What the spell fires and how that lands |
| `onHit` | The effect it leaves on what it hits, such as a burn or a freeze, and the effects that effect ends |
| `cast` | The cast's animation and timing |
| `muzzle` | The effects and sounds at the wand tip as it charges and fires |

```jsx
// server/main.js
// Confringo's fireball, carrying Glacius's freeze to whatever it hits.
Spells.define({
  id: "Frostfire",
  base: "Confringo",
  name: "Frostfire",
  description: "A fireball that freezes whatever it strikes.",
  parts: { onHit: "Glacius" },
  incantation: "Glacius",
  stats: { cooldown: 8 },
});
```

With `parts: { projectile: "Glacius", onHit: "Glacius" }`, the same Confringo fires an ice bolt that freezes.

### Icons

`icon` is a PNG in one of your resources, written `"<resource>/<path>.png"`, such as `"my-spells/img/firestorm.png"`. The spell bar and the spell menus show it in place of the base's symbol. Each player's game reads it from the resource it downloaded, so:

- the file must be in the server's `resources/` directory when you define the spell, or `define` throws;
- the resource must list it in its manifest's `files`;
- the resource needs a client script, because a resource without one never [reaches players](/guides/getting-started/first-resource/#what-reaches-the-player).

### Reading and removing spells

`Spells.get(id)` returns one spell, matching the id whatever its case, or `null`. `Spells.list()` returns every one. A definition reads back as the server keeps it: the spells it names are spelled the game's way, `name` is filled in, and `icon` and `incantation` are `null` where they are the base's. Its `lock` is `Spell_` followed by its id.

The server holds up to 32 defined spells, across every resource. They belong to the server, not to the resource that defined them, so they stay when it stops. Defining the same spell again when it starts back changes nothing.

`Spells.remove(id)` removes a spell for players who join later. Players already connected keep it until they reconnect, so close its lock for them as well. It returns `false` for an id the server doesn't hold.

## Giving players the spell

A defined spell starts locked for every player. Open its lock through the [spell policy](/guides/players/progression/#spells), the way you open any spell, and it joins the player's spell menu. Players then put it on the spell bar from that menu, and `Spells.setLoadoutSlot(slot, id)` slots it from a client script. Closing the lock again takes it away and clears it from the spell bar.

```jsx
// server/main.js
const firestorm = Spells.define({ id: "Firestorm", base: "Confringo", name: "Firestorm", stats: { damage: 40, cooldown: 6 } });

Events.on("worldReady", (player) => {
  player.emit("spells:policy", JSON.stringify({ unlocked: ["Spell_Lumos", "Spell_Stupefy", firestorm.lock], spellSets: 1, revoked: [] }));
});
```

The client half is the `spells:policy` handler in [Progression](/guides/players/progression/#spells). The game only shows the spell bar once Lumos is open, so a server that hands out spells opens `Spell_Lumos` too.

To make players earn a spell, run a lesson for it and open the lock when they finish; see [Lessons of your own](#lessons-of-your-own).

## Casting

A player casts a defined spell like any other, and every player's game shows it with its own parts and numbers. On the caster's client, `spellCast` names it by its id rather than a spell record.

On the server, `playerSpellCast(player, spell, cast)` fires when a player casts a defined spell. `spell` is its id, and `cast` says where it was aimed:

| Field | Meaning |
| --- | --- |
| `aimYaw` | The world yaw the cast was aimed along, in degrees: where the caster's camera pointed, or the caster's facing when their game sent none |
| `wand` | The caster's wand tip as the cast began, as `{ x, y, z }`. Their position when their game sent none, or one more than 5 m from them |

What a cast does to what it hits comes from its base and parts. Anything more is a script: heal on a cast, summon something, or change its PvP hits in the [policy](/guides/pvp/hits-and-defeat/#the-policy-hook).

```jsx
// server/main.js
// Mend runs Arresto Momentum, which only slows what it hits. The heal is ours.
Spells.define({ id: "Mend", base: "ArrestoMomentum", name: "Mend", description: "Restores some of the caster's health.", incantation: "none", stats: { cooldown: 12 } });

Events.on("playerSpellCast", (player, spell) => {
  if (spell !== "Mend") return;
  const vitals = /** @type {{ hp: number; max: number } | null} */ (Pvp.getVitals(player.id));
  if (vitals) player.setHealth(Math.min(vitals.max, vitals.hp + 40));
});
```

The caster's game reports each cast, at most 4 a second per player, and the server drops the rest. A modified game can report casts it never made, so use the event for effects like these, not for anything a cheater must not be able to trigger. See [Authority](/guides/core-concepts/authority/).

## Spells in PvP

The server [prices every PvP hit](/guides/pvp/hits-and-defeat/#damage) itself. Defined spells and spells that mods add are outside its damage table, so each has its own rule.

### Defined spells

A hit by a defined spell is named by its id: that is the `spell` the [policy](/guides/pvp/hits-and-defeat/#the-policy-hook) and `pvpHit` see, and the policy's `spellId` is 0. The server prices it from the definition, never from what the caster's game says:

1. `Pvp.setSpellDamage(id, damage)`, when you have set one, with the id spelled as you defined it;
2. otherwise its `damage` stat. For a base that burns, such as Crucio, `damage` is per second, and `duration` is how many seconds it burns, up to 60;
3. otherwise its base's price.

The price then scales with `damageScale` and the players' damage multipliers, like any spell's. A `damage` of 1,000,000 or more kills. A spell whose base is the Killing, Cruciatus or Imperius Curse counts as that curse, so `curses: "off"` keeps it away from players.

### Modded spells

A modded spell is one outside the game's own list of player spells: a spell a CurseForge mod adds, or an enemy's spell a mod hands to players. The caster's game reports its hit by the spell's record path, priced from its own copy of the spell's data. The server can't check that, so it caps the price at the `moddedSpellCap` rule: 100 by default, per hit, before `damageScale`. For a spell that burns, the cap covers the whole burn.

`Pvp.setSpellDamage` with the spell's record path or name sets its price exactly, past the cap. The server log names each modded spell the first time one of its hits lands, with that call.

```js
// server/main.js
Pvp.configure({ moddedSpellCap: 40 });
Pvp.setSpellDamage("DA_Spell_CrucioVehemSpellRecord", 60);
```

A modded spell whose own damage kills stays lethal, whatever the cap. Under `curses: "off"`, the server drops a modded spell's hit when its damage kills or its record's name holds `AvadaKedavra`, `Crucio` or `Imperius`. In the policy, a modded spell has `spellId` 0 and its record path as `spell`.

The cap never applies to a defined spell: the server knows its numbers.

## Summoning a Patronus

A spell can summon something the game's spells never do. This one runs Depulso, silently and without damage, and the Patronus is not part of the spell: on `playerSpellCast`, the script creates a [world object](/guides/world/objects-and-effects/#world-objects) from one of the game's creatures, gives it the glow of the game's own Patronus, and sends it galloping off along the cast's `aimYaw` for three seconds. A shockwave plays at the wand tip. What the cast hits still gets Depulso's knock-back.

```jsx
// server/main.js
const asset = (path) => `/Game/${path}.${path.split("/").pop()}`;

const STAG = asset("RiggedObjects/Characters/Creatures/Stag/SK_DeerStag");
const GALLOP = asset("Animation/Creatures/Deer/Deer_BM_Gallop_anm");
const GLOW = asset("VFX/MasterMaterials/MaterialInstance/VFX_MI_CIN_Glow_Patronus");
const TRAIL = asset("VFX/Particles/Magic/Patronus/VFX_NS_CIN_PatronusRabbit_Trail");
const PULSE = asset("VFX/Particles/Magic/Patronus/VFX_NS_Patronus_Shockwave");
const PUFF = asset("VFX/UI/Patronus/VFX_NS_Patronus_Spawn");

Spells.define({
  id: "PatronumStag",
  base: "Depulso",
  name: "Expecto Patronum (Stag)",
  description: "Summons a stag Patronus that charges ahead of you.",
  icon: "my-spells/img/patronus_stag.png",
  incantation: "none",
  stats: { cooldown: 30, damage: 0 },
});

let summons = 0;
Events.on("playerSpellCast", (player, spell, cast) => {
  if (spell !== "PatronumStag") return;
  const key = `my-spells:patronus:${++summons}`;
  const heading = (cast.aimYaw * Math.PI) / 180;
  const at = player.position;

  Fx.create(`${key}:pulse`, PULSE, { x: cast.wand.x, y: cast.wand.y, z: cast.wand.z, ttl: 2 });
  WorldObject.create(key, STAG, {
    x: at.x + Math.cos(heading) * 120,
    y: at.y + Math.sin(heading) * 120,
    z: at.z,
    yaw: cast.aimYaw - 90, // the game's creature meshes face +Y
    collision: false,
    animation: GALLOP,
    material: GLOW,
    fx: TRAIL,
    fxSocket: "Pelvis",
    motion: { speed: 900, heading: cast.aimYaw, followGround: true },
    ttl: 3.2,
    shrinkOut: 0.4,
    startFx: PUFF,
    endFx: PUFF,
  });
});
```

Its icon is a PNG under the resource's `img/`, listed in its manifest's `files`, and the resource has a client script so the icon reaches players.

## Lessons of your own

The game teaches each spell with a lesson: the player traces the spell's shape while a spark runs along it, and presses the button each checkpoint shows as the spark reaches it. `SpellLearning.start` plays the game's own lessons; see [Spell lessons](/guides/players/progression/#spell-lessons). A client script can also add lessons of its own with `SpellLearning.define(id, lesson)`, and `SpellLearning.start(id)` runs one like a stock lesson. Its `spellLearningFinished` result carries your id as `spell`.

A lesson starts from one of the game's, named by `look`, and changes only what you set. Or it brings a `path` of its own, a list of points on a 1024 × 1024 canvas, with x to the right and y down. Its art is then drawn from the points, so it needs no images:

```js
// client/main.js
SpellLearning.define("LumosHard", {
  title: "Lumos (advanced)",
  look: "Lumos",
  chaser: 0.6,
  checkpoints: [{ at: 0.2, button: 2 }, { at: 0.45, button: 3 }, { at: 0.7 }, { at: 0.9, button: 4 }],
});

const { ok, reason } = SpellLearning.define("Fulgari", {
  title: "Fulgari",
  icon: "Confringo",
  path: [[200, 850], [500, 200], [520, 820], [820, 180]],
});
if (!ok) console.log(`The Fulgari lesson was refused: ${reason}`);
```

| Field | Meaning |
| --- | --- |
| `title` | The lesson's title, up to 128 characters. Required |
| `look` | One of `SpellLearning.supportedSpells()` to start from: its path, art, checkpoints, chaser and icon |
| `path` | 3 to 65 `[x, y]` points, 800 to 4000 px long in all. Replaces the look's path |
| `checkpoints` | Up to 16 button prompts along the path; see below |
| `finalButton` | The button, 1 to 4, shown at the end of the path. 1 by default |
| `chaser` | When the bad spark starts chasing; see below |
| `icon` | A spell whose spell-bar icon to show, such as `"Confringo"`, or a PNG among the resource's files. The look's by default |
| `art` | Hand-drawn art instead of the drawn stroke: `{ path, mask }`, two PNGs among the resource's files |
| `stroke` | The width of the drawn stroke, 8 to 160 px. 56, the stock lessons' width, by default |

A lesson needs a `look`, a `path` or both.

Each checkpoint is `{ at, button, window }`. `at` is how far along the path it sits, between 0 and 1, at least 100 px past the one before. `button` is 1 to 4, and 1 by default. `window` is `[before, after]` in pixels along the path, each 10 to 400: the prompt opens `before` ahead of the checkpoint and counts as missed `after` past it. It is `[150, 100]` by default. Without `checkpoints`, a lesson keeps its look's, and a new path gets one about every 300 px, 4 to 10 in all.

`chaser` is the bad spark's head start, in seconds. A number is the delay on Normal: Easy doubles it, Hard halves it, and Story has no chaser. Since Easy's delay can't pass 30 seconds, the number can be at most 15. `{ story, easy, normal, hard }` sets each difficulty instead, above 0 and up to 30 seconds, or `null` for no chaser there. `null` alone means no chaser at all. Left out, a lesson keeps its look's, and one with no look has none. A missed button only costs the player a speed boost, so a lesson without a chaser can't be failed.

PNG paths are relative to the resource's own directory, such as `"img/lesson-path.png"`, and the files must be listed in its manifest's `files`. Hand-drawn art is two 1024 × 1024 images with the stroke in their alpha: `path` is the stroke drawn white, and `mask` is the same stroke shaded from black at its start to white at its end.

`define` returns `{ ok, reason }`. When it refuses a lesson, `reason` says why:

| Reason | Meaning |
| --- | --- |
| `invalid-id` | The id is empty, over 32 characters, or holds something other than letters, digits and `_` |
| `stock-name` | The id is the name of one of the game's lessons |
| `too-many` | The resource already has 16 lessons |
| `busy` | That lesson is running |
| `invalid-title` | No title, or one over 128 characters |
| `unknown-look` | `look` is not one of the game's lessons |
| `invalid-path` | Neither `look` nor `path`, or a path outside its limits |
| `invalid-checkpoint` | A checkpoint or `finalButton` outside its limits |
| `invalid-chaser`, `invalid-stroke` | `chaser` or `stroke` outside its limits |
| `unknown-icon` | `icon` names no spell icon |
| `file-not-found`, `invalid-image` | A PNG is not among the resource's files, or doesn't read as an image |
| `unavailable` | The player's game could not take the lesson. The client log says why |

A resource's lessons are its own: two resources can use the same id. `SpellLearning.lessons()` lists them, `SpellLearning.undefine(id)` removes one, and they go when the resource stops. `define` works before the player is in the world. Neither `define` nor `undefine` can change a lesson while it runs.

A lesson grants nothing. To teach a defined spell, run its lesson and open its lock when the player completes it:

```js
// client/main.js
SpellLearning.define("Firestorm", { title: "Firestorm", look: "Confringo", chaser: 4 });

Events.on("lessons:start", (data) => SpellLearning.start(data.id));

Events.on("spellLearningFinished", (result) => {
  if (result.status === "completed") Events.emitServer("lessons:completed", { id: result.spell });
});
```

```js
// server/main.js
Events.onClient("lessons:completed", (player, data) => {
  if (!data || data.id !== "Firestorm" || !mayLearn(player, data.id)) return;
  grantSpell(player, "Spell_Firestorm"); // add the lock to the player's stored policy and send it again
});
```

## Where to go next

- [Progression](/guides/players/progression/#spells) — the spell policy, spell slots and the game's own lessons.
- [Hits and defeat](/guides/pvp/hits-and-defeat/) — how a PvP hit lands, what it costs and what the policy can change.
- [Objects and effects](/guides/world/objects-and-effects/) — the world objects and effects a cast can summon.
