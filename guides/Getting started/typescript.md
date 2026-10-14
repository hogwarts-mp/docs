---
title: Use TypeScript
description: Get autocomplete and type checking for the whole API, either in plain JavaScript or by compiling TypeScript.
sidebar:
  order: 120
---

The runtime runs JavaScript, but every release also publishes the API's TypeScript declarations on npm as [`@hogwartsmp/types`](https://www.npmjs.com/package/@hogwartsmp/types). Install them in a resource and your editor knows every global, its members and their types. It autocompletes them and flags a misspelled method, or a client-only global used on the server, before you start the server.

There are two ways to use them. Keep writing JavaScript and let the editor check it, or write TypeScript and compile it to the JavaScript your manifest runs.

## Install the declarations

The package version is the release version. From the resource's directory, install the one your server runs:

```sh
npm install --save-dev --save-exact @hogwartsmp/types@1.9.0
```

A resource's `package.json` is also an ordinary npm manifest, so the dependency is recorded beside the `mafiahub` block. As long as the manifest declares `files`, only what it lists [reaches players](/guides/getting-started/first-resource/#what-reaches-the-player); `node_modules/` stays on your machine and the server's disk.

## One program per side

Server and client scripts see different globals, so each side is its own TypeScript program and names its half of the package in `types`: `@hogwartsmp/types/server` or `@hogwartsmp/types/client`. Set `lib` to an ECMAScript version and leave out `DOM`. The runtime declares its own `console` and timers, and the DOM's would clash with them.

## Check plain JavaScript

Add a `jsconfig.json` to each side's folder. Editors such as VS Code apply it to the scripts beneath it:

```text
resources/my-gamemode/
├── package.json
├── server/
│   ├── jsconfig.json
│   └── main.js
└── client/
    ├── jsconfig.json
    └── main.js
```

```jsonc
// server/jsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "node16",
    "types": ["@hogwartsmp/types/server"],
    "checkJs": true
  }
}
```

The client's is the same with `@hogwartsmp/types/client`. `checkJs` turns on error reporting; leave it out to get autocomplete alone. To check every script from the command line, install the compiler and run it once per side without writing any output:

```sh
npm install --save-dev --save-exact typescript@5.9.3
npx tsc -p server/jsconfig.json --noEmit
npx tsc -p client/jsconfig.json --noEmit
```

## Compile TypeScript

Keep the sources in `src/` and compile each side into `dist/`, which is what the manifest runs:

```text
resources/my-gamemode/
├── package.json
├── tsconfig.json          # the server program
├── src/
│   ├── server/
│   │   └── main.ts
│   └── client/
│       ├── tsconfig.json  # the client program
│       └── main.ts
└── dist/                  # compiled JavaScript
```

Install the compiler next to the declarations, then point the manifest at the compiled files and add a build script:

```sh
npm install --save-dev --save-exact typescript@5.9.3
```

```json
{
  "name": "my-gamemode",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p src/client/tsconfig.json"
  },
  "devDependencies": {
    "@hogwartsmp/types": "1.9.0",
    "typescript": "5.9.3"
  },
  "mafiahub": {
    "serverScripts": ["dist/server/main.js"],
    "clientScripts": ["dist/client/main.js"],
    "files": ["dist/client/**/*.js"]
  }
}
```

`files` ships every compiled client module, so an `import` between your client files still resolves on the player's machine.

The server program sits at the resource root:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "node16",
    "types": ["@hogwartsmp/types/server"],
    "strict": true,
    "noEmitOnError": true,
    "rootDir": "src/server",
    "outDir": "dist/server"
  },
  "include": ["src/server"]
}
```

The client program sits beside its sources:

```jsonc
// src/client/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "node16",
    "types": ["@hogwartsmp/types/client"],
    "strict": true,
    "noEmitOnError": true,
    "rootDir": ".",
    "outDir": "../../dist/client"
  },
  "include": ["."]
}
```

| Option | Why |
| --- | --- |
| `"module": "node16"` | Both runtimes load scripts as CommonJS modules. Without `"type": "module"` in `package.json`, the compiler turns each `import` into the `require()` they understand. |
| `"noEmitOnError": true` | The compiler writes JavaScript even when type checking fails. Without this, a broken build replaces the last good one in `dist/`. |
| `rootDir`, `outDir` | Each side compiles into its own folder, the one the manifest names. |

A server entry with a typed handler:

```ts
// src/server/main.ts
const banned = new Set<string>(["76561190000000000"]);

Events.on("playerConnecting", (connection) => {
  if (banned.has(connection.steamId)) connection.reject("You are banned from this server.");
});
```

A client entry. A custom event's payload is `unknown`, so narrow it before using it:

```ts
// src/client/main.ts
Events.on("my-gamemode:announce", (payload) => {
  if (typeof payload === "string") Game.notify(payload);
});
```

Build, then restart the resource to load the new `dist/`:

```sh
npm run build
```

The client side runs in a sandbox whose `require()` loads only your own files by relative path, so a client program can import its own modules but not npm packages. To use a package on the client, bundle the client program into one file with a bundler such as esbuild instead.

## Typing event handlers

Every native event is declared with the arguments its handlers receive, so a handler's parameters are typed without annotations, in TypeScript and in checked JavaScript alike:

```ts
// src/server/main.ts
Events.on("chatCommand", (player, message, command, args) => {
  if (command === "wave") Chat.sendToAll(`${player.nickname} waves at ${args.join(" ") || "everyone"}.`);
});

Events.on("npcDied", (npcId, enemyId, killerId) => {
  if (killerId !== null) new Player(killerId).sendChat(`You defeated ${enemyId}.`);
});
```

The compiler also holds you to what an event can carry: `killerId` above is `number | null`, so using it without the check is an error. Events your own resources emit are not declared, so their payloads stay `unknown` until you narrow them.

## Node.js modules on the server

Server scripts run in Node.js and may `require` its modules. To type them, install `@types/node` and add `"node"` to the server program's `types`. Node's declarations bring their own `console`, so also set `skipLibCheck`:

```jsonc
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "types": ["node", "@hogwartsmp/types/server"],
    "skipLibCheck": true
  }
}
```

## Upgrading the server

When the server moves to a new release, install the matching declarations and rebuild. Anything the release renamed or removed shows up as a type error:

```sh
npm install --save-dev --save-exact @hogwartsmp/types@<version>
npm run build
```

## Where to go next

- [Your first resource](/guides/getting-started/first-resource/) for the manifest, load order and sharing code between resources.
- [Events](/guides/core-concepts/events/) for the event catalog and the client/server bridge.
