# HogwartsMP documentation

Public, maintainer-authored guides for the HogwartsMP scripting API.

The closed-source Mod remains authoritative for generated client and server API contracts. It publishes those contracts as immutable artifacts to MafiaHub Services. This repository downloads a public contract revision, composes it with the authored guides, generates the complete site, and deploys it to the standalone documentation service.

## Structure

- `guides/` contains scripting concepts and tutorials.
- `guides/server/` may contain server-only guides and catalogs.
- Image directories live beside the Markdown document that references them.
- `docs.config.json` owns the generator pin, branding, links, navigation, and community-content mapping.
- `scripts/sync_contract.mjs` downloads and verifies the public scripting contract.
- `scripts/docs.mjs` is the single local and CI generation entrypoint.
- `src/styles/production.css` is shared by the standalone site and local preview.

The closed-source Mod repository owns only contract generation and publication. It does not render, deploy, or trigger this documentation website.

## Contributing

Open a pull request with the guide or asset change. Keep local image references relative to the Markdown file and avoid active HTML such as scripts, forms, iframes, or inline event handlers.

### Local preview

The preview is completely public and does not require the closed-source Mod, Hogwarts Legacy, a Services checkout, platform credentials, or an upload token. It downloads the same unauthenticated scripting contract used by CI and runs the complete production generator, including Server API, Client API, guides, branding, and navigation.

Install Node.js 22 or newer, clone this repository, and install the pinned dependencies:

```sh
git clone https://github.com/hogwarts-mp/docs.git
cd docs
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
```

Start the local development server:

```sh
pnpm dev
```

Open <http://localhost:4321/>. The first run downloads the current `testing` contract into the ignored `.cache/` directory. Edit Markdown, colocated images, `docs.config.json`, or `src/styles/production.css`; the complete production site rebuilds and the browser refreshes automatically.

To download the contract without starting the preview:

```sh
pnpm docs:sync
```

Set `HOGMP_CONTRACT_CHANNEL`, `HOGMP_CONTRACT_REVISION`, or `HOGMP_API_URL` to select another public contract. A manual deployment can pin an exact immutable revision; otherwise it resolves the selected public channel when the workflow starts.

Before opening a pull request, verify the affected pages at desktop and mobile widths and run:

```sh
pnpm build
git diff --check
```

The generated `dist/` is the same static artifact deployed in CI. Merges to `main` deploy against the selected contract channel, while the Mod independently publishes contracts and stops there.
