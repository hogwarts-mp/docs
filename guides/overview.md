---
title: Overview
description: What a HogwartsMP resource is, where its code runs, and which guide to open first.
sidebar:
  order: 1
---

HogwartsMP resources run JavaScript in one of two environments:

- **Server resources** run in Node.js and own authoritative game state.
- **Client resources** run in a sandboxed V8 context and control local presentation and input.

Use the navigation to browse the globals available to the selected environment. The same declarations that generate this reference can be loaded by an editor for autocomplete and type checking.

## Finding your way

**Start here:**

- [Run a local server](/guides/getting-started/local-server/) — a server on your own machine to join and reload resources on while you work.
- [Your first resource](/guides/getting-started/first-resource/) — the manifest, script roles, load order, and sharing code between resources.
- [Debugging](/guides/getting-started/debugging/) — where output and errors go on each side, and what an error does to a resource.

**The ideas everything builds on:**

- [Authority](/guides/core-concepts/authority/) — what the server owns, what clients run and report, and how to handle what a client sends.
- [Events](/guides/core-concepts/events/) — listeners, the client/server bridge, the runtime event catalog, and the trust boundary.
- [State bags](/guides/core-concepts/state-bags/) — your own keys and values on players and other entities, replicated to the clients that need them.
- [Virtual worlds](/guides/core-concepts/virtual-worlds/) — separate copies of the world for arenas, events and spectators.

**Players:**

- [Join and spawn](/guides/players/join-and-spawn/) — admitting players, the events of a visit, spawn points, deaths and respawns.
- [Chat and commands](/guides/players/chat-and-commands/) — sending chat, taking over the chat relay, and slash commands.
- [Inventory](/guides/players/inventory/) — the server-owned inventory, atomic changes, saving inventories, and items the game hands out.
- [Appearance](/guides/players/appearance/) — saving and restoring looks, the character creator, clothes, house, size, disguises and props.

**NPCs and creatures:**

- [NPCs](/guides/npcs-and-creatures/npcs/) — spawning enemies, controlling their health, targets and size, and their damage and death events.
- [Beasts and characters](/guides/npcs-and-creatures/beasts-and-characters/) — tame creatures players care for, and stationary townspeople.

**Encounters:**

- [Encounter policy](/guides/encounters/encounter-policy/) — whether Overland's camps and roaming encounters are off, spawned by each player's game, or run by the server.
- [Camps](/guides/encounters/camps/) — server-run enemy camps, how they come back, and when they are cleared.
- [World events](/guides/encounters/world-events/) — the roaming encounters, their cooldowns, and starting or resetting one yourself.
- [Zones](/guides/encounters/zones/) — areas the server watches for players and other entities coming and going.

**PvP:**

- [Rules and relations](/guides/pvp/rules-and-relations/) — which players may fight: the rules, pairs, flags and teams.
- [Hits and defeat](/guides/pvp/hits-and-defeat/) — how a hit lands, what it costs, the policy hook, kneeling and death, and health recovery.
- [Duels and wand links](/guides/pvp/duels-and-wand-links/) — one-on-one duels and the game's beam contest.

**World:**

- [Time and weather](/guides/world/time-and-weather/) — the shared clock, calendar, season and weather, holiday decor and the Headmaster's office.
- [Objects and effects](/guides/world/objects-and-effects/) — placing props from the game's meshes and visual effects.
- [Doors](/guides/world/doors/) — holding the game's doors locked or open for everyone, and deciding who gets in.
- [Loot](/guides/world/loot/) — server-owned chests, moonstones and foragables, per-player contents, and switching off the game's own loot.

**Room of Requirement:**

- [Rooms](/guides/room-of-requirement/rooms/) — loading rooms under ids of your own, letting players decorate them, and saving what they build.
- [Doors and visits](/guides/room-of-requirement/doors-and-visits/) — where each player's door leads, taking players in, visitors, and who is where.

**User interface:**

- [Web views](/guides/user-interface/web-views/) — HTML interfaces in the game, and messages between the page and your scripts.
- [HUD, prompts and nametags](/guides/user-interface/hud-and-nametags/) — hiding the game's HUD, interaction prompts, and what players' nametags show.
- [Map markers](/guides/user-interface/map-markers/) — markers, search circles and routes on the map, player blips, and the minimap.
- [Keys and menus](/guides/user-interface/keys-and-menus/) — key bindings, locking the controls, and keeping the game's own menus shut.

**Camera and sound:**

- [Camera](/guides/camera-and-sound/camera/) — taking over the view with shots, paths and orbits, fades, and handing it back.
- [Audio](/guides/camera-and-sound/audio/) — the game's sounds from the server or a client, soundbanks and music.
- [Voice chat](/guides/camera-and-sound/voice-chat/) — who hears whom, voice ranges and tiers, muting, and each player's voice settings.

**Mounts and races:**

- [Brooms and mounts](/guides/mounts-and-races/brooms-and-mounts/) — giving players brooms and creatures, mounting and dismounting, flight overrides, and keeping riders out.
- [Races](/guides/mounts-and-races/races/) — the game's broom races on tracks of your own, for several players, timed by the server.
- [Quidditch](/guides/mounts-and-races/quidditch/) — the ball, hoops, bludgers and snitch, with the match run on the server.

**Running a server:**

- [Hosting a server](/guides/hosting-a-server/run-a-server/) — installing on Windows or Linux, Foundations, ports, the masterlist, and updates.
- [Server configuration](/guides/hosting-a-server/configuration/) — every `server.json` key, command-line flags, passwords, and required mods.
- [Docker and game panels](/guides/hosting-a-server/docker/) — the public server image, Compose, and the Pterodactyl and Pelican egg.

## Server example

```js
Events.on("playerConnect", (player) => {
  player.sendChat(`Welcome to Hogwarts, ${player.nickname}!`);

  const npc = NPC.create("Goblin_Grunt", 250, 120, 0, "hostile");
  if (npc) {
    npc.setMaxHealth(500);
  }
});
```

## Server-authoritative inventory

Server resources load and save inventory however they choose. The framework only owns the connected session shadow and its projection into the native client:

```js
Events.on("playerConnect", (player) => {
  loadInventory(player, (items) => {
    player.inventory.replace(items, (error) => {
      if (error) player.kick(`Inventory sync failed: ${error.code}`);
    });
  });
});

function reward(player, itemId, count) {
  player.inventory.give(itemId, count, {}, (error, result) => {
    if (error) {
      console.error(error.code, error.message);
      return;
    }
    console.log(`inventory revision ${result.revision} sent`);
  });
}
```

`player.inventory.list()`, `count()`, and `has()` read only server memory. Client inventory state never grants items to the server inventory.

## Client example

```js
Events.on("season", (payload) => {
  Game.notify(`The season is now ${payload.name}`);
});

const pos = LocalPlayer.getPosition();
if (pos) {
  console.log(pos.x, pos.y, pos.z);
}

Key.bind("f6", () => {
  if (Camera.active) {
    Camera.clearLookAt();
    Camera.restore({ duration: 0.5, curve: "easeOut" });
    return;
  }

  const target = LocalPlayer.getPosition();
  const view = Camera.capture();
  if (!target || !view) return;
  Camera.activate({ position: { x: target.x + 300, y: target.y, z: target.z + 100 }, rotation: view.rotation });
  Camera.orbit(target, { radius: 300, height: 100, speed: 25 });
});
```

> Server and client declarations must be loaded separately. A global shown in one environment is not automatically available in the other.
