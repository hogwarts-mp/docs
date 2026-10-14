---
title: Run a local server
description: Run a bare server on your own machine, join it, and reload a resource after every change without restarting.
sidebar:
  order: 10
---

To develop a resource you need a server you control and a client to join it with. Both come in the release ZIP, and a server for local work needs nothing else: no Foundations, no database and no open ports.

## 1. Set up the server

Download the release ZIP from the `#releases` channel in the [HogwartsMP Discord](https://discord.gg/RzqENjGe99) and extract it. Copy everything inside its `server/` directory to a directory of your own, and create an empty `resources/` directory beside `HogwartsMPServer.exe`:

```text
C:\HogwartsMPDev\
├── HogwartsMPServer.exe
├── ...
└── resources\
```

Start it from that directory. The server finds `server.json`, `resources/` and `logs/` relative to the directory it runs in:

```powershell
cd C:\HogwartsMPDev
.\HogwartsMPServer.exe
```

The first start writes a default `server.json`, and its defaults suit local work. The console shows the log as the server runs, and the same lines go to `logs/hogwarts-mp.log`. A few lines written before the server has read its configuration, such as the note that it wrote `server.json`, go to `logs/framework.log` instead.

On Linux, use the release's `server-linux/` directory and install the libraries listed in [Install the server](/guides/hosting-a-server/run-a-server/#linux).

## 2. Add a resource

Every directory directly under `resources/` that holds a `package.json` is a resource. Discovery goes one level deep, so `resources/my-gamemode/package.json` is found, and a resource in a grouping directory such as `resources/[gamemodes]/my-gamemode/` is not.

Name the directory after the manifest's `name`. Console commands take the manifest's name, while the runtime attributes log lines and errors to a resource by its directory, so keeping the two equal keeps both pointing at the same resource.

Create the resource from [Your first resource](/guides/getting-started/first-resource/) and start the server again. A resource that started logs:

```text
[12:34:56] [info] [Scripting] Started JS resource: my-gamemode
```

## 3. Join it

Start HogwartsMP with the launcher from the same release, open **Play**, and connect to `127.0.0.1`. The client and server must come from the same release, or the client is turned away before it loads in.

## 4. Reload after a change

The server console takes commands, and these manage resources while the server keeps running:

| Command | What it does |
| --- | --- |
| `ensure <resource>` | Restarts a running resource after reading its `package.json` again, or starts a stopped one. The command to use after an edit. |
| `restart <resource>` | Stops and starts a running resource without reading `package.json` again. |
| `stop <resource>` | Stops a resource. `stop` on its own stops the server. |
| `start <resource>` | Starts a stopped resource, and prints the error if it fails. |
| `refresh` | Finds resource directories added since the server started. It starts nothing. |
| `refreshall` | Reads every manifest again and restarts every resource that was running. |
| `help` | Lists every command. |

`<resource>` is the manifest's `name`, and the resources that depend on it stop and start with it. A directory added while the server runs needs `refresh` before `start` can find it.

Restarting a resource restarts its client half for every player already connected: their clients download the changed files and run the new client scripts without reconnecting. Two things do not happen again:

- `playerConnect` does not fire again for players who are already online. A resource that sets players up when they connect should also set up the players in `PlayerManager.getAll()` when it starts.
- Anything the resource kept only in memory is gone. The NPCs, beasts, world objects and other entities it created are destroyed when it stops, so they spawn fresh when it starts.

### When a reload fails

`ensure` and `restart` echo the resource's name even when it fails to start again, for example after a syntax error. Check for the `Started JS resource` line after each reload. If it is missing, the resource is stopped: run `start <resource>` to print the error, fix it, and run `start` again.

### Automatic reload

A server built from source in the Debug configuration also watches its running resources, and reloads one about a second after any of its files changes. It skips `node_modules` and `.git`. The server in the release ZIP does not watch, so use `ensure` there.

## Where to go next

- [Your first resource](/guides/getting-started/first-resource/) for the manifest, load order and sharing code between resources.
- [Use TypeScript](/guides/getting-started/typescript/) for autocomplete and type checking.
- [Debugging](/guides/getting-started/debugging/) for where output and errors go, on both sides.
