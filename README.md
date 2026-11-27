# preview

View-only 3D previews of your models for your customers. A workshop uploads each version of a model (a 3MF, a preview image, optional drawings); every customer gets one secret link to a page with their models, where they turn and zoom each one in 3D, see its versions with their notes, and can't download it. Customers need no account; you revoke or renew a link at any time.

**Work in progress:** this is the scaffold, with sign-in, API tokens, MCP and REST in place. Customers, models, uploads and the customer pages follow; the plan is [`docs/superpowers/plans/2026-11-27-preview-app.md`](docs/superpowers/plans/2026-11-27-preview-app.md).

preview is one Next.js app in one Docker image, on [next-app-kit](https://github.com/Marceltov/next-app-kit), which brings the sign-in, API tokens, MCP, REST, migrations and uploads. Its data is two SQLite files and the uploaded files, in one directory.

## Running it

With Docker Compose, behind a reverse proxy that terminates TLS:

```sh
mkdir preview && cd preview
curl -fsSLO https://raw.githubusercontent.com/3D-Bruckner/preview/main/compose.yaml
curl -fsSL -o .env https://raw.githubusercontent.com/3D-Bruckner/preview/main/.env.example
chmod 600 .env    # then fill it in: PUBLIC_URL, PREVIEW_SECRET, PREVIEW_ALLOWED_EMAILS, a way to sign in
docker compose up -d
```

It listens on `127.0.0.1:3000`; point your reverse proxy there. `/health` answers `{"status":"ok"}` once it runs.

## Settings

Every setting is an environment variable in `.env`; [`docs/configuration.md`](docs/configuration.md) lists them all, with the data directory and what a backup needs. The ones that make it yours:

- `PREVIEW_BRAND_NAME`, `PREVIEW_BRAND_URL`: your name in the header and the title, and where it links to.
- `PREVIEW_ACCENT_COLOR`: your colour, as hex.
- `PREVIEW_LOGO`: your logo, an SVG or PNG inside the data directory.
- `PREVIEW_IMPRINT_URL`, `PREVIEW_PRIVACY_URL`: the footer's links on every page (operators in Germany need both).

The pages speak German and English, German by default; a visitor can switch.

## Uploading from a workshop

A script uploads with an API token (`read+write`), made on the settings page, over MCP (`create_api_token`) or on the server ([configuration](docs/configuration.md#the-image)). The REST API is described at `<PUBLIC_URL>/api/v1/openapi.json` (committed as [`openapi.json`](openapi.json)); Claude manages everything else over MCP at `<PUBLIC_URL>/mcp` ([the tools](docs/mcp.md)).

## Developing

Node 26 (`.nvmrc`):

```sh
nvm use && npm ci
cat > .env.local <<'ENV'
PUBLIC_URL=http://localhost:3000
PREVIEW_SECRET=a-development-secret-of-at-least-32-characters
DATA_DIR=./data
PREVIEW_DEV_USER=you@example.org
ENV
npm run dev            # http://localhost:3000, signed in as PREVIEW_DEV_USER
```

`PREVIEW_DEV_USER` skips the sign-in in development (refused in production; it can't make API tokens or MCP connections); set `PREVIEW_SMTP_URL` instead to sign in by mail. The checks CI runs:

```sh
npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build && npm run generate -- --check
```

How it is built: [architecture](docs/architecture.md); why: [ADR 0001](docs/adr/0001-a-viewer-of-our-own.md).

## Licence

AGPL-3.0-only ([`LICENSE`](LICENSE)). Contributions from outside need the [contributor licence agreement](CLA.md) ([`CONTRIBUTING.md`](CONTRIBUTING.md)); vulnerabilities are reported as [`SECURITY.md`](SECURITY.md) says.
