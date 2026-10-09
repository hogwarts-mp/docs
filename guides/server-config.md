---
title: Server configuration
group: Guides
sidebar:
  order: 5
---

The server takes its settings from `server.json` in its working directory, and command-line flags can override some of them. This page lists every key and flag. To install a server first, see [Hosting a server](/guides/hosting/).

## server.json

On first start, if `server.json` is missing and the directory is writable, the server writes one with every key the build understands, set to its default. That generated file is the authoritative list for your release, so edit it rather than writing one from scratch.

A complete file, with a password and a custom HTTP port:

```json
{
  "host": "0.0.0.0",
  "port": 27015,
  "apihost": "127.0.0.1",
  "apiport": 27016,
  "map": "",
  "maxplayers": 32,
  "server-token": "",
  "password": "castle-gate",
  "mod": {
    "curseforge": {
      "mods": []
    },
    "autoRespawn": true
  }
}
```

Every key is optional: one you leave out takes its default. Restart the server after editing the file.

### Framework keys

| Key | Default | Meaning |
| --- | --- | --- |
| `host` | `0.0.0.0` | Interface the game socket binds to. `0.0.0.0` accepts players on every interface. |
| `port` | `27015` | Game port (**UDP**). Players connect here. |
| `apihost` | `0.0.0.0` | Interface the [information API](#information-api) binds to. Set `127.0.0.1` to keep it off the network. |
| `apiport` | `27016` | Information API port (**TCP**). |
| `map` | `""` | Reserved. HogwartsMP ignores it; leave it empty. |
| `maxplayers` | `32` | Connection cap. This build allows at most **128**; a higher value logs a warning and runs with 128. |
| `server-token` | `""` | Masterlist key from the [MafiaHub dashboard](https://mafiahub.dev/dashboard/servers). Empty keeps the server unlisted. See [List it publicly](/guides/hosting/#8-list-it-publicly). |
| `password` | `""` | Password players must enter to join. Empty lets anyone in. See [Passwords](#passwords). |

### Mod keys

HogwartsMP's own settings live under the `mod` object, so they can never collide with framework keys added later.

| Key | Default | Meaning |
| --- | --- | --- |
| `curseforge.mods` | `[]` | CurseForge project IDs every connecting player must activate. See [Required CurseForge mods](#required-curseforge-mods). |
| `autoRespawn` | `true` | Whether a dead player respawns on their own after a few seconds. See [Respawning](#respawning). |

### Validation

The file is checked at boot, so a mistake stops the server with a reason instead of surfacing at the first connect:

- **Invalid JSON** stops it with `JSON config load has failed:` and the parser's error.
- **A framework key with the wrong type**, such as `"port": "27015"` or `null`, stops it with `JSON config could not be applied: … type must be number, but is string`. That message names the type, **not the key**, so compare each value against the table above.
- **A `mod` key with the wrong type** stops it with a message that names the key, such as `'mod.autoRespawn' must be a …`.
- **An unknown `mod` key** is kept, with a warning that the build does not understand it. A config written for a newer release still loads on an older one.
- **Unknown top-level keys** are ignored, so documentation keys such as `"_comment"` are harmless.

The server also rejects a `port` or `apiport` outside 1–65535, a `maxplayers` of zero or less, and a `password` over 255 bytes.

## Command-line flags

Flags override the matching `server.json` keys for that run. A flag you do not pass never overrides the file.

| Flag | Overrides | Purpose |
| --- | --- | --- |
| `-h`, `--host` | `host` | Game bind address |
| `-p`, `--port` | `port` | Game port (UDP) |
| `-H`, `--apihost` | `apihost` | Information API bind address |
| `-P`, `--apiport` | `apiport` | Information API port (TCP) |
| `-t`, `--server-token` | `server-token` | Masterlist key |
| `--password` | `password` | Join password |
| `-c`, `--config` | | Read a different configuration file instead of `server.json` |
| `--help` | | Print the flags and exit |

For example, to run a second server from another directory on the next pair of ports:

```sh
./HogwartsMPServer --port 28015 --apiport 28016
```

`maxplayers`, `map` and the `mod` keys have no flags; set them in the file. Game panels use flags to inject the port and token they manage. That is why the [Pterodactyl egg](/guides/docker/#pterodactyl-and-pelican) overrides whatever `server.json` says for those keys.

> On a shared machine, other users can read a process's command line. Prefer `server.json` for `server-token` and `password` there, and keep that file readable only by the server's account.

## Passwords

Set `password` (or pass `--password`) to make players enter it before they are admitted. Players type it into the **Password** field on the **Play** screen, next to the address. You can also send it in a `hogwartsmp://` [join link](/guides/hosting/#7-join-it) as `?password=…`.

**Keep it to 64 plain ASCII characters or fewer, with no spaces at either end.** The server accepts up to 255 bytes, but the Play screen trims spaces from both ends and sends at most 64 bytes. A password that breaks either rule can never be typed correctly.

The server reports that a password is required to the masterlist and in its information API. It never reports the password itself.

## Required CurseForge mods

`mod.curseforge.mods` lists CurseForge projects every client must activate before entering your server. The list is sent during the connection handshake, and supported clients set up that server's mod set before the world loads.

The list starts empty, and it should stay empty until you have chosen and tested a mod. An accidental entry affects every player who connects. To require one, add its **numeric project ID** as a string:

```json
"mod": {
  "curseforge": {
    "mods": ["YOUR_CURSEFORGE_PROJECT_ID"]
  }
}
```

That is a fragment of `server.json`, not a complete file, and the placeholder has to be replaced. Several projects are separate strings in the same array. Do not use a URL, project name, slug or file ID, or an ID copied from another server without knowing what it installs. Set the array back to `[]` to require nothing.

## Respawning

With `mod.autoRespawn` at its default of `true`, a dead player stands back up on their own a few seconds after dying. Set it to `false` and a dead player stays where they fell, still watching the world, until a script respawns them with `player.respawn()`. Game modes with revives, spectating or round-based play use this.

Scripts can override it for one player with `player.setAutoRespawn(on)`. Passing `null` restores the `server.json` value. See the Server API reference.

## Information API

The server answers `GET /` on `apiport` with a JSON summary: `mod_name`, `mod_slug`, `mod_version`, `framework_version`, `host`, `port`, `password_required`, `max_players` and `mod_config`. It is handy for a quick health check from the host itself:

```sh
curl http://127.0.0.1:27016/
```

Players do not need it to join, and the masterlist does not read it: the server announces itself. It binds every interface by default, so either block its port at the firewall or set `apihost` to `127.0.0.1`.

## Changing ports

Moving the game port means changing three things together: `port` (or `--port`), the firewall or router rule, and any container port mapping. Then tell players the new port, because the client assumes 27015 unless the address carries `:port`. When you run several servers on one machine, give each its own directory and its own pair of `port` and `apiport`.
