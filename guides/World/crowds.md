---
title: Crowds
description: Bring back the game's own students, townsfolk and shopkeepers on a player's client, keep chosen NPCs out of the world, and thin the crowd area by area.
sidebar:
  order: 502
---

In the single-player game, Hogwarts and the villages fill with people on their own schedules: named students and shopkeepers, crowds of extras, and background figures who come and go. The game's scheduler puts them out in each player's game separately, so every call on this page is a client call and changes only that player's world.

## Turning the crowd on

The Mod keeps this population out by default, so areas load empty. `World.setAmbientPopulation(true)` brings it back on this client, and `World.ambientPopulation()` reads the setting. `false` switches it off again and sends every background extra already out away.

```js
// client/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName === "my-gamemode") World.setAmbientPopulation(true);
});

Events.on("resourceStop", (resourceName) => {
  if (resourceName === "my-gamemode") World.setAmbientPopulation(false);
});
```

### Keeping a few people while it is off

`World.setPopulationExemptions(names)` keeps named NPCs on their schedules while the population is off, so that a character bound to one place is not missing from it, such as the Fat Lady from her portrait:

```js
// client/main.js
World.setPopulationExemptions(["FatLady"]);
```

It replaces the whole list and returns it without repeats or empty names, and `World.populationExemptions()` reads it. Taking a name off the list stops scheduling that NPC, but does not remove one already in the world.

## Keeping NPCs out

`World.setPopulationExclusions(exclusions)` keeps chosen NPCs out of the world, with the population on or off. `names` lists NPCs by their scheduled-entity name, such as `"GerboldOllivander"`, and `types` by kind:

| Type | Keeps out |
| --- | --- |
| `"students"` | Named and crowd students, prefects, young students and background students: the subtypes `Student`, `Prefect`, `T3Student`, `T3YoungStudent` and `T4Student` |
| `"townsfolk"` | Named and crowd townsfolk, workers, young children and background townsfolk: `Townsperson`, `T3Townsperson`, `T3Worker`, `T3YoungChild` and `T4Townsperson` |
| `"vendors"` | The 26 NPCs who sell, by name, including Arn, Penny and MarianneMoffett, whose subtype is not `Vendor` |
| A game subtype, such as `"Professor"`, `"Ghost"` or `"T3Student"` | Every NPC of that subtype. `PopulationType` in the Client API reference lists them all. |

A gamemode that places its own shopkeepers keeps the game's out:

```js
// client/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  World.setAmbientPopulation(true);
  World.setPopulationExclusions({ types: ["vendors"] });
});
```

- An NPC already out goes away within a second. Drop it from the lists and it comes back on its own schedule.
- Background extras go by their own subtypes, `T4Student`, `T4Townsperson`, `T4DarkWizard` and `T4Goblin`, and the `"students"` and `"townsfolk"` groups include the first two. Once one is excluded, no new extra of that kind comes out, but extras already out stay until the game sends them back, and the extras filling seats are not filtered by type.
- Each call replaces both lists and returns them, as `{ names, types }`, without repeats or empty names. `World.populationExclusions()` reads them.
- An unknown type, or a list that is not an array of strings, throws a `TypeError` and leaves the lists as they were. Names are not checked, so a misspelt name keeps nobody out.

### Finding names

`World.scheduledEntities()` lists every NPC the game's scheduler holds on this client:

| Field | Meaning |
| --- | --- |
| `name` | What `setPopulationExemptions` and `setPopulationExclusions` take. Crowd NPCs may share one. |
| `type` | Its game subtype, such as `"Vendor"` or `"T3Student"` |
| `spawned` | Whether it is in the world now |
| `excluded` | Whether `setPopulationExclusions` keeps it out |
| `position` | Where its schedule has it, spawned or not |

Named NPCs are listed wherever they are, and crowd NPCs only while the crowd has them out. To learn a name, stand near the NPC and list the people around the player:

```js
// client/main.js
function listPeopleNearby() {
  const here = LocalPlayer.getPosition();
  if (!here) return;
  for (const npc of World.scheduledEntities()) {
    if (!npc.spawned) continue;
    const dist = Math.hypot(npc.position.x - here.x, npc.position.y - here.y);
    if (dist < 2000) console.log(`${npc.name} (${npc.type}) ${Math.round(dist)} cm away`);
  }
}
```

The output goes to the [client log](/guides/getting-started/debugging/#where-output-goes).

## Thinning the crowd

`World.setPopulationDensity(density)` lets out only a share of the crowd on this client, from 0, no crowd, to 1, the game's own. Every crowd lane, from wandering and seated students and townsfolk to people walking set routes and the extras around the game's world events, may have only that share of what the player's own Population quality setting allows, and that share of background extras gets through.

For a density per area, set it as the player moves between regions. This one empties Hogsmeade's streets and keeps Hogwarts quiet:

```js
// client/main.js
function densityIn(region) {
  if (region.startsWith("HM_") || region.startsWith("Hogsmeade")) return 0;
  if (region.startsWith("HOG_") || region === "Hogwarts") return 0.3;
  return 1;
}

Events.on("playerRegionChanged", (region) => World.setPopulationDensity(densityIn(region)));
```

- It thins the crowd `setAmbientPopulation(true)` brought back. Named NPCs, shopkeepers included, are not thinned: keep them out with `setPopulationExclusions`.
- A crowd already out thins as it turns over, not at once.
- A value outside 0 to 1 is clamped, and anything but a finite number throws a `TypeError`. It returns the value applied, and `World.populationDensity()` reads it. It is 1 by default.

## One setting for each client

A client holds one exemption list, one pair of exclusion lists and one density, not one for each resource: each call replaces whatever any resource set before. They stay when the resource that set them stops, and go back to their defaults, empty lists and a density of 1, when the player leaves the server.

Resources that share a client should agree on which of them sets these, or add to what is already set:

```js
// client/main.js
function excludeAlso(names) {
  const current = World.populationExclusions();
  World.setPopulationExclusions({ names: [...(current.names ?? []), ...names], types: current.types });
}
```

Clear your lists, and switch the population off if you switched it on, when your resource stops.

## Where to go next

- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) for placing the server's own figures, such as shopkeepers.
- [Doors](/guides/world/doors/#common-rooms) for opening other houses' common rooms to a player.
- [Events](/guides/core-concepts/events/) for `playerRegionChanged` and the other client events.
