---
title: Your first resource
description: Build a minimal resource with a manifest and server and client scripts, then learn load order, sharing code and cleaning up.
sidebar:
  order: 110
---

Everything a game mode does in HogwartsMP lives in a **resource**: a directory containing a `package.json` manifest and one or more JavaScript files. The server discovers every resource directory under `resources/` at startup, runs its server scripts in Node.js, and packages its client scripts and assets for each connecting player, where they run in a sandboxed V8 context.

This guide builds a minimal two-file resource and explains every field along the way.

## Directory layout

```text
resources/
└── my-gamemode/
    ├── package.json      # manifest: script roles, dependencies, error behavior
    ├── server/
    │   └── main.js       # runs on the server (Node.js)
    └── client/
        └── main.js       # runs on every player's machine (sandboxed V8)
```

The split matters: the two sides see **different globals** and never share memory. The server owns authoritative game state — players, NPCs, beasts, world objects, inventory, the replicated environment. The client owns local presentation and input — the HUD, the camera, web views, the local player's native components. They talk through [events](/guides/core-concepts/events/).

## The manifest

```json
{
  "name": "my-gamemode",
  "version": "1.0.0",
  "author": "You",
  "description": "My first HogwartsMP game mode",
  "mafiahub": {
    "clientScripts": ["client/main.js"],
    "serverScripts": ["server/main.js"]
  }
}
```

`name` is required and must be unique across loaded resources; a duplicate is rejected with a warning. `version`, `description`, and `author` follow npm conventions. Everything HogwartsMP-specific sits under the `mafiahub` key:

| Key | Meaning |
| --- | --- |
| `clientScripts` | Scripts executed on every connecting player. Shipped to clients. |
| `serverScripts` | Scripts executed on the server. **Never shipped to clients.** |
| `sharedScripts` | Scripts executed on both sides. Shipped to clients. Run before the role-specific ones. |
| `files` | Files shipped to clients but not executed — web-view pages, styles, images, fonts. Globs allowed. |
| `exports` | Names this resource registers for other resources to read (see below). |
| `resourceDependencies` | Resources that must be present, as names or `{ "name", "version", "optional" }` objects. |
| `errorBehavior` | What happens on an uncaught runtime error: `stop` (the default), `restart`, or `continue`. |

Scripts run in the order you list them, shared scripts first. Paths are relative to the resource root and must be explicit files — only `files` accepts globs, so execution order is always exactly what the manifest says.

> A manifest without a `mafiahub` block runs nothing. The npm `main` field is not an entry point: the runtime only executes the paths listed under `clientScripts`, `serverScripts`, and `sharedScripts`.

The older `client`, `server`, and `clientFiles` keys still work — they fold into the lists above at parse time. To move across, replace `"client": "client/main.js"` with `"clientScripts": ["client/main.js"]`, `"server"` with `"serverScripts"`, and list your assets under `"files"`.

### What reaches the player

A resource is packaged into an encrypted container and delivered to each connecting client. **What ships is derived from the roles you declare**, not from a separate list: `clientScripts`, `sharedScripts`, `files`, and `package.json` go out; `serverScripts` never does. Keep credentials, database queries, and admin checks in `serverScripts` and they stay on the server.

If a resource declares no `files`, the packager falls back to scanning the directories holding your client scripts and warns in the server log. That fallback cannot tell a server bundle from a client one, so declare `files` on anything that ships assets.

### Load order

Resources are started in dependency order: the server topologically sorts them over `resourceDependencies`, so a library always starts before the resources that consume it. A missing required dependency is reported, a dependency cycle aborts the start, and a dependency marked `"optional": true` is skipped with a warning when it is absent.

```json
{
  "name": "my-gamemode",
  "mafiahub": {
    "serverScripts": ["server/main.js"],
    "resourceDependencies": [
      { "name": "shared-utils", "version": ">=1.0.0" }
    ]
  }
}
```

> A `priority` number is accepted in the manifest for compatibility, but the current runtime orders resources only by their declared dependencies. Declare `resourceDependencies` when order matters.

## A minimal server entry

```js
// server/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  console.log("started");

  // Server-authoritative environment, replicated to every client.
  World.setTime(15, 30);
  World.setSeason(3);
  World.setWeather("Snow_01");
});

Events.on("playerConnect", (player) => {
  console.log(`${player.nickname} connected (ping ${player.ping}ms)`);
  player.sendChat(`Welcome to Hogwarts, ${player.nickname}!`);
});
```

`resourceStart` fires once per resource as it loads, with the resource's name as the argument, and it is delivered to every running resource — so guard on your own name. `console` is resource-aware: its output is already prefixed with the resource that wrote it.

## A minimal client entry

```js
// client/main.js
Events.on("resourceStart", (resourceName) => {
  if (resourceName !== "my-gamemode") return;

  Game.notify("Welcome to Hogwarts!");
});

// Sent by the server with Events.emitAllClients or player.emit.
Events.on("mygm:announce", (payload) => {
  Game.notify(payload.text);
});
```

Keep authoritative decisions on the server and let the client draw the result. See [Events](/guides/core-concepts/events/) for the full client/server bridge and the trust boundary that comes with it.

## Sharing code between resources

A resource can register values under an export name, and any other resource can read them. This is how shared libraries work:

```json
{
  "name": "shared-utils",
  "version": "1.0.0",
  "mafiahub": {
    "sharedScripts": ["utils.js"],
    "exports": ["utils"]
  }
}
```

```js
// resources/shared-utils/utils.js
const utils = {
  randomIn(values) {
    if (!values || values.length === 0) return undefined;
    return values[Math.floor(Math.random() * values.length)];
  },
};

Exports.register("utils", utils);
```

Consuming it takes one call — plus the dependency declaration above, so the loader guarantees `shared-utils` is present and started first:

```js
// resources/my-gamemode/server/main.js
const utils = Exports.get("shared-utils", "utils");
```

Reading an export from a resource you have not declared as a dependency produces a warning. `Imports.get(resourceName)` returns every export of a resource as one object when you prefer a single handle over per-name lookups. For request/response messaging between resources, use `Messages.handle` and `Messages.request`.

## Cleaning up

When a resource stops, the runtime releases what it held: its event subscriptions, timers and exports, and the native UI holds it was keeping (the Field Guide, action screen, and tool wheel). The entities its scripts created — NPCs, beasts, world objects, effects, characters — are destroyed, whether the resource was stopped or stopped because of an error.

`resourceStop` is for what the runtime cannot do for you, such as saving state or telling players. It is dispatched while the resource is stopping, before its timers, exports, and event handlers are cleaned up, so its handles are still usable inside it:

```js
// server/main.js
Events.on("resourceStop", (resourceName) => {
  if (resourceName !== "my-gamemode") return;
  Chat.sendToAll("The game mode is restarting.");
});
```

## Persisting state

HogwartsMP has no built-in database, and anything a resource only holds in memory is gone when the server stops. Server scripts run in Node.js, so a resource saves to whatever store it brings. On public servers that is usually [`hmp-mysql`](https://github.com/hogwarts-mp/foundations/tree/main/resources/hmp-mysql) from HMP Foundations, which shares one pooled MySQL or MariaDB connection with every resource that declares it as a dependency and reads it through `Imports.get("hmp-mysql")`.

That includes player inventories: a joining player starts with an empty inventory, and it is dropped when they leave. [Saving inventories](/guides/players/inventory/#saving-inventories) shows how to keep it between visits.

## Editor autocomplete

The same TypeScript declarations that generate this reference are published on npm as `@hogwartsmp/types`, versioned with the release. Install the version your server runs as a dev dependency and name your side in a `jsconfig.json` or `tsconfig.json`, `"types": ["@hogwartsmp/types/server"]` or `"types": ["@hogwartsmp/types/client"]`, and your editor autocompletes and type-checks the whole API. [Use TypeScript](/guides/getting-started/typescript/) walks through both setups.

> Load the server and client declarations **separately**. A global shown in one environment is not automatically available in the other: `Hud`, `Camera`, and `LocalPlayer` are client-only; `PlayerManager`, `NPCManager`, and `InventoryCatalog` are server-only; `World` and `Pvp` exist on both sides with different members.

## Where to go next

- [Events](/guides/core-concepts/events/) — listeners, the client/server bridge, the runtime event catalog, and the trust boundary.
- The **Server API** and **Client API** references in the navigation — every global available to each environment.
