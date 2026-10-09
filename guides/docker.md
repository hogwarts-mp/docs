---
title: Docker and game panels
group: Guides
sidebar:
  order: 6
---

Every release publishes the Linux dedicated server as a public container image:

```text
ghcr.io/hogwarts-mp/hogwartsmp-server:<version>
```

The image holds the same native server the release ZIP ships, repackaged on Ubuntu 24.04 for `linux/amd64`. It is not a source build, and like the ZIP it carries **no game-mode resources**. Pulling it needs no login.

Tags are exact release versions with no leading `v`, such as `1.8.0`. There is no `latest`, `stable` or `testing` tag, because the server must match the release your players run: a mismatched client is rejected before it loads in. Changing the tag is how you update.

This page covers the container. Configuration, Foundations, ports and the masterlist work exactly as in [Hosting a server](/guides/hosting/).

## Docker Compose

Create a directory for the server with this `compose.yaml`:

```yaml
services:
  server:
    image: ghcr.io/hogwarts-mp/hogwartsmp-server:${HOGWARTSMP_VERSION:?Set HOGWARTSMP_VERSION to a released version}
    platform: linux/amd64
    restart: unless-stopped
    init: true
    ports:
      - "27015:27015/udp"           # game traffic: must be reachable by players
      - "127.0.0.1:27016:27016/tcp" # information API: this host only
    volumes:
      - server-data:/home/container
    stop_grace_period: 30s

volumes:
  server-data:
```

Next to it, create a `.env` that pins the release:

```dotenv
HOGWARTSMP_VERSION=1.8.0
```

Start it and follow the log:

```sh
docker compose pull
docker compose up -d
docker compose logs -f server
```

The server is up when the log shows `HogwartsMP Server successfully started`. Open UDP 27015 on the host or cloud firewall as well. Publishing a port in Compose does not open it in a firewall in front of the machine.

Without Compose, the same container is:

```sh
docker run -d --name hogwartsmp --init --restart unless-stopped \
  -p 27015:27015/udp -p 127.0.0.1:27016:27016/tcp \
  -v hogwartsmp-data:/home/container \
  ghcr.io/hogwarts-mp/hogwartsmp-server:1.8.0
```

## Data and resources

`/home/container` is the server's working directory and its volume. Everything that must survive an upgrade lives there:

```text
/home/container/
├── server.json      # written with defaults on first start
├── resources/       # your game mode, e.g. the hmp-* Foundations resources
├── data/            # Foundations' hmp-*.json configuration
├── logs/
└── .packages/       # resource package key and cache; keep it
```

The server runs as UID and GID `10001`, not root. A named volume handles ownership for you. To manage resources from the host instead, bind-mount a directory over `resources/` and make it writable by that UID:

```yaml
    volumes:
      - server-data:/home/container
      - ./resources:/home/container/resources
```

```sh
sudo chown -R 10001:10001 ./resources
```

Install Foundations by copying its `hmp-*` directories into `resources/` and its example configs into `data/`, as in [Install HMP Foundations](/guides/hosting/#4-install-hmp-foundations). Restart the container after changing resources or `server.json`.

### Database and secrets

Inside the container, `127.0.0.1` is the container itself, not the host. Point `data/hmp-mysql.json` (or `HMP_MYSQL_HOST`) at a database the container can reach. With a MySQL service in the same Compose file, that is the service's name. Foundations' [database guide](https://github.com/hogwarts-mp/foundations/blob/main/DATABASE.md#option-2-docker-on-the-game-server-machine) has a ready-made MySQL container. Never publish the database's port to the internet.

Foundations reads its secrets from the process environment. Keep them in a file next to `compose.yaml`, readable only by you, and hand it to the service:

```yaml
services:
  server:
    # ...
    env_file: foundations.env
```

## Ports and flags

Arguments after the image name go straight to the server, as the [command-line flags](/guides/server-config/#command-line-flags). Change the published ports to match:

```sh
docker run -d --name hogwartsmp --init --restart unless-stopped \
  -p 28015:28015/udp -p 127.0.0.1:28016:28016/tcp \
  -v hogwartsmp-data:/home/container \
  ghcr.io/hogwarts-mp/hogwartsmp-server:1.8.0 --port 28015 --apiport 28016
```

In Compose, edit `command` and `ports` together:

```yaml
    command: ["--port", "28015", "--apiport", "28016"]
    ports:
      - "28015:28015/udp"
      - "127.0.0.1:28016:28016/tcp"
```

Keep the container port equal to the published port, as above. Mapping `28015:27015` would have the server advertise 27015 to the masterlist while players need 28015.

## Update

Stop the server, back up the volume and the Foundations database, then move the tag:

```sh
docker compose down
# edit .env: HOGWARTSMP_VERSION=<new release>
docker compose pull
docker compose up -d
```

The runtime lives in the image, so there is nothing to copy. Your volume keeps `server.json`, `data/` and `resources/`; replace the Foundations pack there with the release that matches. The [update checklist](/guides/hosting/#update-to-a-new-release) still applies.

The server handles `SIGTERM` and `SIGINT` by shutting down cleanly: every resource's stop handlers run and state is saved. `docker stop` and `docker compose down` send `SIGTERM`, and the 30-second grace period gives the shutdown time to finish.

## Pterodactyl and Pelican

Each release has a ready-made egg that points at that release's exact image, so importing it pins the version. The egg ships inside the image, so you can extract it from any machine with Docker:

```sh
docker run --rm --user 0 --entrypoint cat ghcr.io/hogwarts-mp/hogwartsmp-server:1.8.0 \
  /usr/share/hogwartsmp/egg-hogwartsmp.json > egg-hogwartsmp.json
```

`--user 0` is needed because the image's default user cannot open the directory that holds the egg.

Then, in the panel:

1. **Admin → Nests → Import Egg**, and upload `egg-hogwartsmp.json`.
2. Create a server from the egg. Its **primary allocation** is the UDP game port players connect to.
3. Assign a **second allocation** for the information API and set the **HTTP port** variable to it. The variable selects a port; it does not allocate one.
4. Set **Masterlist token** to your [server key](/guides/hosting/#8-list-it-publicly), or leave it blank for an unlisted server. The panel's value overrides any `server-token` in `server.json`.
5. Start the server. The panel marks it running once the log shows `HogwartsMP Server successfully started`.

The install step only creates `resources/`, `logs/` and `.packages/`. Upload Foundations or your own resources into `resources/` through the panel's **File Manager** or SFTP, and edit `server.json` there for the keys the panel does not control, such as `maxplayers` and `password`. The panel stops the server with `^C`, which is the same clean shutdown as `SIGINT`.

To update, switch the server's Docker image to the next release's tag in its startup settings, or update the egg from that release's file, then restart. There is nothing to reinstall.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Players are rejected immediately | The image tag and the players' client are from different releases. |
| The server runs but has no game mode | Expected on a fresh volume. The image ships no resources; install Foundations into `resources/`. |
| `Permission denied` writing `resources/`, `logs/` or `server.json` | A bind mount is not writable by UID `10001`. `chown -R 10001:10001` the host directory. |
| The panel is stuck on **Starting** | The panel waits for `HogwartsMP Server successfully started`. Read the console for the error that came first. |
| `libnode.so.141: cannot open shared object file` | The panel's startup command no longer runs `/opt/hogwartsmp/HogwartsMPServer`, or `LD_LIBRARY_PATH` was overridden. The image sets it; leave it alone. |
| Foundations reports `ECONNREFUSED` | `127.0.0.1` inside the container is the container. Use the database service's name or the host's address. |
| Exits on a VPS with `CPU doesn't support invariant TSC` | Add `TRACY_NO_INVARIANT_CHECK=1` to the container's environment. |
| Players cannot connect | Confirm the UDP port is published, opened in the host and cloud firewalls, and equal on both sides of the mapping. |
