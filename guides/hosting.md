---
title: Hosting a server
group: Guides
sidebar:
  order: 4
---

A HogwartsMP server is one executable plus a `server.json` configuration file and a `resources/` directory. The release ships the runtime only, with no game mode. Public servers run **HMP Foundations**, a complete resource pack that adds characters, inventory, banking, jobs, shops, administration and other common systems on top of a MySQL or MariaDB database.

This guide takes a fresh machine to a server players can join, then covers keeping it running and updating it. It is for server owners. Players only need the [player guide](https://github.com/hogwarts-mp/hosting/blob/main/PLAYER_GUIDE.md).

## What you need

| | Why |
| --- | --- |
| A Windows x64 or Linux x86-64 host | The dedicated server is native on both. Linux needs **glibc 2.38 or newer**: Ubuntu 24.04+ or Debian 13+. |
| The release ZIP from the official `#builds` channel in the [HogwartsMP Discord](https://discord.gg/RzqENjGe99) | It must be the **same release your players run**. A mismatched client is rejected before it loads in. |
| MySQL 8.x or MariaDB 10.6+ | Foundations stores its data there. A bare server with no resources needs no database. |
| An [HMP Foundations release](https://github.com/hogwarts-mp/foundations/releases) | The supported starting point for a public server. Its [compatibility matrix](https://github.com/hogwarts-mp/foundations/blob/main/COMPATIBILITY.md) names the HogwartsMP release it pairs with. |
| Control of the host firewall, and of the router on a home connection | Players reach the server on **UDP 27015**. |

> Running in Docker or under Pterodactyl or Pelican? The server's [public image](/guides/docker/) packages this same runtime. Read on for configuration, Foundations and the masterlist, then follow that page for the container itself.

## 1. Get the release

Download the complete ZIP from `#builds` and extract it. It is arranged like this:

```text
HogwartsMP-<version>-<commit>/
├── client/          # your own client copy
├── server/          # Windows dedicated server
└── server-linux/    # Linux dedicated server
```

Do not send the archive or its `client/` directory to players, and do not mirror or modify it. Every player downloads their own copy from `#builds`, and the launcher keeps it updated after that. Do not combine a server directory from one archive with a client from another.

## 2. Install the server

### Windows

1. Create a permanent directory such as `C:\HogwartsMPServer`.
2. Copy everything inside the release's `server` directory into it.
3. Create empty `resources`, `logs` and `data` directories next to `HogwartsMPServer.exe`.

An ordinary user account can run the server, provided it can write to that directory. Do not run it elevated; nothing in the server requires administrator rights.

### Linux

Install the runtime libraries the server links against. These are the packages the official container image installs on Ubuntu 24.04, plus `unzip` for extracting Foundations:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates libcurl4t64 libssh2-1 libssl3t64 libstdc++6 zlib1g unzip
```

Create an unprivileged system account to own and run the server. This is a local account on the host, not a cloud provider's IAM service account:

```sh
sudo useradd --system --home-dir /opt/hogwartsmp --shell /usr/sbin/nologin hogwartsmp
```

Then install the runtime from the directory where you extracted the archive:

```sh
sudo install -d -o hogwartsmp -g hogwartsmp /opt/hogwartsmp
sudo cp -a HogwartsMP-*/server-linux/. /opt/hogwartsmp/
sudo install -d /opt/hogwartsmp/resources /opt/hogwartsmp/logs /opt/hogwartsmp/data
sudo chown -R hogwartsmp:hogwartsmp /opt/hogwartsmp
sudo chmod +x /opt/hogwartsmp/HogwartsMPServer /opt/hogwartsmp/crashpad_handler
```

The `chmod` matters: an extracted archive does not always keep the executable bit. Keep `HogwartsMPServer`, `crashpad_handler` and `libnode.so.141` together. The last one is the bundled Node.js runtime that executes server resources, and a `libnode` from another release will not work.

Never run the server as root.

## 3. Create `server.json`

The server reads `server.json` from its **working directory**. Create it next to the executable:

```json
{
  "host": "0.0.0.0",
  "port": 27015,
  "maxplayers": 32,
  "server-token": "",
  "mod": {
    "curseforge": {
      "mods": []
    }
  }
}
```

That is enough for a first start. The server also writes a complete default file on its first start if none exists, listing every key the build understands. Leave `server-token` empty until you [list the server](#8-list-it-publicly).

Every key, the join password, the command-line overrides and the required-mod list are covered in [Server configuration](/guides/server-config/).

## 4. Install HMP Foundations

Foundations is installed separately from the server and versioned as one unit: install every `hmp-*` resource from a single release, and never mix resource versions. Its own [installation guide](https://github.com/hogwarts-mp/foundations/blob/main/INSTALL.md) is authoritative. In short:

1. Create an empty `hogwartsmp` database and a non-root account scoped to it, following the [database guide](https://github.com/hogwarts-mp/foundations/blob/main/DATABASE.md). Do not import a schema; Foundations creates and migrates its own tables.
2. Copy every `hmp-*` directory from the release's `resources` directory into your server's `resources/`. They must sit directly under it, with no extra `hmp-foundations/` level in between.
3. Copy the release's example `data/hmp-*.json` files into your server's `data/` and replace every `CHANGE_ME` value. `data/hmp-mysql.json` holds the database connection.
4. Remove any older resources the installation guide lists as overlapping. Two stacks loaded side by side give duplicate commands and UI.

Secrets such as the admin bootstrap secret are read from the server process's **environment**. Foundations does not load `.env` files on its own:

```text
HMP_ADMIN_BOOTSTRAP_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
HMP_ADMIN_REQUIRE_VERIFIED=true
HMP_ADMIN_UNSAFE_ASSERTED_BANS=false
```

The database, `data/` and these secrets are server data. They are never sent to clients.

## 5. Open the ports

| Port | Protocol | Expose it? | Purpose |
| --- | --- | --- | --- |
| `27015` | UDP | **Yes**, to the internet | Game traffic. Forward it through the router when hosting at home. |
| `27016` | TCP | No | Server information HTTP API. It binds every interface by default, so firewall it. Players do not need it. |
| `3306` | TCP | **Never** | MySQL or MariaDB. Restrict it to the server host or a private network. |

On Linux with ufw:

```sh
sudo ufw allow 27015/udp
```

On Windows, allow the program when Windows Defender Firewall asks on first start, or add the rule from an elevated PowerShell. The rule needs administrator rights; the server does not:

```powershell
New-NetFirewallRule -DisplayName "HogwartsMP" -Direction Inbound -Protocol UDP -LocalPort 27015 -Action Allow
```

On a cloud host, open the same UDP port in the provider's firewall or security group as well. Test from a machine **outside** your network: connecting from the host itself proves nothing about the public path, and TCP port checkers cannot test a UDP port.

## 6. Start it

Start MySQL or MariaDB first, then the server, with the server directory as the working directory.

On Windows:

```powershell
Set-Location C:\HogwartsMPServer
.\HogwartsMPServer.exe
```

On Linux:

```sh
cd /opt/hogwartsmp
sudo -u hogwartsmp ./HogwartsMPServer
```

The server finds `server.json`, `resources`, `data` and `logs` relative to the directory it runs in, so always start it from its own directory. A shortcut, scheduled task or service that only points at the executable starts in the wrong directory and finds no configuration or resources. Set its **Start in** or working directory too.

A healthy first boot logs lines like these:

```text
HogwartsMP Server successfully started
[hmp-mysql] connected to 127.0.0.1:3306/hogwartsmp
[hmp-core] Accounts, characters, groups and metadata are ready
```

followed by ready messages from the rest of the `hmp-*` resources. `Server will not be announced to masterlist` is expected while `server-token` is empty. **Do not admit players if any resource logs `Startup failed`.** The full log is written to `logs/hogwarts-mp.log`.

The console accepts `status` (address and player count), `help`, and `stop` or `quit` to shut down cleanly. In a release build, restart the server after changing resources or `server.json`.

## 7. Join it

Start HogwartsMP through the launcher, open **Play**, and enter the server's address, or pick it from the list once it is [listed](#8-list-it-publicly). The client assumes port 27015, so add `:port` only if you changed it. Fill **Password** only if the server [sets one](/guides/server-config/#passwords).

You can also hand players a link. The launcher registers the `hogwartsmp://` scheme each time it runs, so once a player has started it once, opening a link connects straight to your server:

```text
hogwartsmp://play.example.com
hogwartsmp://203.0.113.10:28015
```

Link a player to a passworded server with `?password=…` appended. Anyone holding that link can join, so do not post it publicly.

Run your first join with a disposable test account and walk through Foundations' [first-player checks](https://github.com/hogwarts-mp/foundations/blob/main/INSTALL.md#5-first-player-checks): create and select a character, reconnect, open the inventory, and confirm `/admin` is denied to a normal player.

## 8. List it publicly

An unlisted server is still reachable by address. To appear in the server list, register it with the MafiaHub masterlist:

1. Sign in at [mafiahub.dev](https://mafiahub.dev/) and open [your servers](https://mafiahub.dev/dashboard/servers).
2. Click **Add a server**. This registers the listing and gives you its **server key**.
3. Put the key in `server.json` as `server-token`, and restart.

No heartbeat script is needed: while running, the server announces its name, address, port and player count, and it appears within a minute or so. The key also pairs the listing with the exact build players need.

The key is a secret. Anyone with it can announce a server as yours, so keep it out of screenshots, support logs, source control and Discord.

## Keep it running

A server started from a terminal stops when the terminal closes, does not come back after a crash, and does not return after a reboot.

### Linux: systemd

Skip this if a game panel manages the process; its daemon already supervises the server. Otherwise create `/etc/systemd/system/hogwartsmp.service`:

```ini
[Unit]
Description=HogwartsMP dedicated server
After=network-online.target mysql.service
Wants=network-online.target
Requires=mysql.service

[Service]
Type=simple
User=hogwartsmp
Group=hogwartsmp
WorkingDirectory=/opt/hogwartsmp
EnvironmentFile=/etc/hogwartsmp.env
ExecStart=/opt/hogwartsmp/HogwartsMPServer
Restart=on-failure
RestartSec=5
StandardInput=null
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Five lines carry the weight:

- `WorkingDirectory` resolves `resources`, `data`, `logs` and `server.json`.
- `Requires=` and `After=mysql.service` hold the server back until the database is up. Without them a reboot races Foundations against MySQL and every resource that depends on `hmp-core` fails. On MariaDB the unit is usually `mariadb.service`. Drop both when the database runs on another machine, or when there is none.
- `EnvironmentFile` supplies Foundations' secrets. The unit file is world-readable, so secrets do not belong in it.
- `Restart=on-failure` brings the server back after a crash.
- `WantedBy=multi-user.target` starts it on boot once the unit is enabled.

Create the private environment file, fill it with `KEY=value` lines, and enable the unit:

```sh
sudo install -m 600 /dev/null /etc/hogwartsmp.env
sudoedit /etc/hogwartsmp.env
sudo systemctl daemon-reload
sudo systemctl enable --now hogwartsmp
```

Day to day:

```sh
systemctl status hogwartsmp          # running? since when? last exit?
sudo systemctl restart hogwartsmp    # after editing server.json or resources
journalctl -u hogwartsmp -f          # live log; add -b for this boot only
```

`StandardInput=null` disables the server console; `systemctl stop` and `systemctl status` replace it. Reboot the host once and confirm the server comes back by itself before opening it to players. That is the only real test that the unit is enabled and ordered after the database.

### Windows: a service wrapper

Use a Windows service wrapper or process manager that restarts the server on exit and starts it at boot. Whichever you choose, set its **working directory** to the server directory and give it the Foundations environment variables.

## Update to a new release

The launcher updates players' clients automatically. It never updates a dedicated server, so every release means:

1. Announce maintenance and stop admitting players.
2. Stop the server cleanly.
3. Back up `server.json`, `data/`, any custom resources, the runtime you are about to replace, and the Foundations database. Foundations documents the dump command under [backups and upgrades](https://github.com/hogwarts-mp/foundations/blob/main/DATABASE.md#backups-and-upgrades).
4. Replace the runtime from the new release, and replace the whole Foundations pack as one unit with the release its compatibility matrix names. On Linux the runtime is `HogwartsMPServer`, `crashpad_handler` and `libnode.so.141`; run `chmod +x` on the first two again afterwards.
5. Read the release notes and example configs for new keys.
6. Start the database, then the server, and wait for every resource's ready message.
7. Join once with a client from the same release and test character selection, inventory and your main gameplay loop.

Keep the previous runtime and the matching database backup until the new build has passed a real connection test. Foundations migrations can be forward-only, so rolling back the server may also mean restoring that backup.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Exits immediately | Read the first error in the log. Confirm the working directory, a writable `logs/`, complete runtime files, and valid JSON. |
| `JSON config could not be applied: … type must be …` | A `server.json` key has the wrong JSON type, such as `"port": "27015"` or `null`. The message names the type, not the key. See [Server configuration](/guides/server-config/#validation). |
| Linux: `version 'GLIBC_2.38' not found` | The distribution is too old. Use Ubuntu 24.04+ or Debian 13+, directly or as a container base. |
| Linux: `libnode.so.141: cannot open shared object file` | Keep the complete Linux bundle together, or start it with `LD_LIBRARY_PATH=/opt/hogwartsmp`. Do not substitute a `libnode` from another release. |
| Linux: exits on a VPS with `Tracy Profiler initialization failure: CPU doesn't support invariant TSC` | The virtual CPU hides a feature the built-in profiler checks for. Start the server with `TRACY_NO_INVARIANT_CHECK=1` in its environment (`Environment=TRACY_NO_INVARIANT_CHECK=1` in the unit). |
| Stops when the terminal closes, or is gone after a reboot | It was started from a shell. Run it under [systemd](#linux-systemd) or a Windows service manager. |
| Every Foundations resource fails after a reboot, but a manual start works | The server raced the database. Add `Requires=` and `After=mysql.service` to the unit. |
| Players cannot connect | Confirm UDP reachability from outside, router forwarding, the address and the port. A TCP port test does not validate UDP. |
| Players connect and are rejected immediately | Client and server come from different releases. Update the server, or have players relaunch so the launcher updates them. |
| Foundations says MySQL is not configured | Install `data/hmp-mysql.json`, or set the `HMP_MYSQL_*` variables in the server's environment. |
| Foundations reports `ECONNREFUSED` | Start MySQL and check its host and port. Inside a container, `127.0.0.1` is the container itself. |
| Foreign-key or migration error | Stop the server and read the earliest Foundations schema error. Do not edit migration history to silence it. |
| A resource depends on a missing resource | The resource set is incomplete or mixes releases. Restore one matching set. |
| Duplicate commands or UI | Overlapping legacy and Foundations resources are both loaded. Keep one owner per system. |
| Not in the server list | Confirm `server-token`, outbound HTTPS, the registration, and the masterlist line in the log. Direct connect keeps working either way. |

When asking for help, include the release, the operating system, a sanitized `server.json`, the resource list, and the first relevant error from `logs/hogwarts-mp.log`. Remove tokens, passwords, database URLs, player addresses and identity information first.

## Related

- [Server configuration](/guides/server-config/): every `server.json` key, command-line overrides, passwords and required mods.
- [Docker and game panels](/guides/docker/): the public server image, Compose, and the Pterodactyl and Pelican egg.
- [Your first resource](/guides/getting-started/): writing your own resources on top of the server.
