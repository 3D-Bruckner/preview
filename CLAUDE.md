# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

preview: view-only 3D previews of a workshop's models for its customers, behind one secret link per customer; versions are uploaded from a script, managed through Claude (MCP) and the web app. A Next.js app on [next-app-kit](https://github.com/Marceltov/next-app-kit).

## Commands

- `npm run dev`: the app on http://localhost:3000 (needs `PUBLIC_URL`, `PREVIEW_SECRET` and a `DATA_DIR` of your own, e.g. in `.env.local`; the README has one).
- `npm run format` / `npm run format:check` (Prettier, 160 columns), `npm run lint` (ESLint), `npm run typecheck` (`next typegen && tsc --noEmit`).
- `npm test` (Vitest); one file: `npm test -- backend/config.test.ts`; one test: `npm test -- -t "refuses a dev user"`.
- `npm run build`; `npm run test:e2e` (Playwright against `next dev` at a phone's 390×844, data in a temporary directory).
- `npm run generate`: writes `openapi.json` from the REST table (`scripts/generate-openapi.mjs`); commit it with any change to `backend/rest.ts` (`backend/rest.test.ts` and CI's `npm run generate -- --check` fail otherwise).
- CI (`.github/workflows/ci.yml`, job `check`) runs all of these in Microsoft's Playwright image on every push and pull request; job `image` builds and starts the image on every push and publishes `ghcr.io/3d-bruckner/preview:main` from main only.

## Architecture

The whole picture is [`docs/architecture.md`](docs/architecture.md); the tools [`docs/mcp.md`](docs/mcp.md); the settings and data directory [`docs/configuration.md`](docs/configuration.md).

- `app/` (pages under `app/[lang]/`, route handlers outside it) and `components/` import the backend only through `@/backend`, or `@/backend/client` in the browser (pure code only); `backend/` never imports Next.js, React or the frontend. ESLint enforces both.
- `backend/db/` alone holds `better-sqlite3`, `kysely` (types excepted), the connection, the migrations and every query; domain code reaches the database only through `rt.store`, and a change runs in `mutation(rt, fn)` (one transaction). ESLint enforces it.
- MCP (`backend/mcp.ts`), REST (`backend/rest.ts`) and the web app's server actions call the same domain functions. Each REST operation names the MCP tool it mirrors or says why none (`checkOpsMirrorTools`); every MCP result carries `guidance`.

## Rules

- Follows Marceltov/engineering-conventions; the rules here win where they differ.
- Open source: the product names no operator, in code, copy, images or defaults. Everything that names whoever runs an instance is a setting in `config.brand` (`PREVIEW_BRAND_NAME`, `PREVIEW_BRAND_URL`, `PREVIEW_ACCENT_COLOR`, `PREVIEW_LOGO`, `PREVIEW_IMPRINT_URL`, `PREVIEW_PRIVACY_URL`).
- Code, logs, MCP descriptions and `guidance` are English. The UI speaks German (the default) and English: its words live in `components/copy/en.ts` (the reference, `type Copy`) and `components/copy/de.ts` (`const de: Copy`); `copy.test.ts` checks both have the same keys, and adding a language is adding one copy file to `components/copy/index.ts`. `react/jsx-no-literals` keeps text out of JSX. `proxy.ts` picks the language (the switch's cookie `preview_lang`, then `Accept-Language`, then German); no URL carries the language. The proxy runs on pages only: Next cuts a proxied body at 10 MB, so route handlers stay out of its matcher and call `languageOf(req.headers)` themselves (`proxy.test.ts`, `bodiesBypassProxy`).
- Settings: `PREVIEW_*`, plus `PUBLIC_URL`, `DATA_DIR`, `PORT`, `TZ` (and the image's `PUID`, `PGID`, `NODE_EXTRA_CA_CERTS`). `backend/config.ts` (`VARIABLES`), `.env.example` and `docs/configuration.md` change together (`envExampleListsEveryVariable`). `PORT` must be the port the app listens on.
- Nothing next-app-kit provides is copied here; what preview needs that another app would need too goes into the kit, as a release. The kit's peers stay at its exact versions (`backend/peers.test.ts`); no `legacy-peer-deps`.
- A migration that has shipped is never edited: a schema change is a new migration at the end of `backend/db/migrations.ts`.
- Tests keep their data in a temporary `DATA_DIR` (`backend/testing/setup.ts`, pinned by `setup.test.ts`).
- Logs (pino, `backend/log.ts`) never hold a token, a link token, a file's name or an email address.
- Architectural decisions go to `docs/adr/NNNN-*.md` (MADR); a changed decision gets a new ADR that supersedes the old one.
- Merge only when Marcel says so. The one exception: Dependabot's patch and minor bumps merge by themselves once CI's `check` is green (`.github/workflows/dependabot-automerge.yml`).
- The design is `docs/superpowers/specs/2026-11-27-preview-design.md`; the plan is `docs/superpowers/plans/2026-11-27-preview-app.md`.
