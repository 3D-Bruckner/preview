# preview: the customer model viewer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new app `3D-Bruckner/preview` that stores rendered 3MF versions per customer and shows them, view-only, on a secret link per customer at `vorschau.3dbruckner.de/k/<token>`.

**Architecture:** One Next.js app in one image, built exactly like `3D-Bruckner/portfolio` (same layout, next-app-kit v0.1.7, SQLite through kysely, Better Auth with Authentik OIDC as the only admin sign-in). Domain in `backend/` (framework-free, `Outcome<T>`), MCP tools in `backend/mcp.ts`, the REST table in `backend/rest.ts` mirroring them, one multipart upload route outside `/api/v1` (as portfolio's photo upload). Customer pages are public routes gated only by the token; the 3D view is three.js in the browser.

**Tech Stack:** Next.js 16.4.6, React 19.3.1, next-app-kit 0.1.7, better-auth 1.7.21, kysely + better-sqlite3, zod 4, fflate, three (exact pin), Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-preview-design.md`. Plans 2 (deployment) and 3 (workshop) follow this one.

## Global Constraints

- Engineering conventions (plugin `engineering-conventions` 0.38.0) apply: read `stacks/nextjs.md`, `stacks/sqlite.md`, `architecture/mcp-first.md`, `architecture/one-gate-for-every-read.md`, `architecture/sign-in.md`, `code/language.md`, `code/accessibility.md`, `repo-setup/*` before Task 1.
- Portfolio is the template: where this plan doesn't say how, do it the way `3D-Bruckner/portfolio` does it, and copy, never re-invent, its infrastructure files. Kit code is never copied into the app.
- Env prefix `PREVIEW_`; app name `preview`; API token prefix `preview_`; port 3000 in the container.
- **Open source from the first commit:** public repository, AGPL-3.0-only with portfolio's CLA, `SECURITY.md`, `CONTRIBUTING.md`; nothing about 3D Bruckner in code, copy, images or defaults. Everything that names the operator is a setting: `PREVIEW_BRAND_NAME` (shown in the header and title; default `Preview`), `PREVIEW_BRAND_URL` (header link, optional), `PREVIEW_ACCENT_COLOR` (hex, default a neutral blue that passes WCAG AA on white), `PREVIEW_LOGO` (path of an SVG/PNG under `DATA_DIR`, optional), `PREVIEW_IMPRINT_URL` and `PREVIEW_PRIVACY_URL` (footer links on every page, optional; German operators need both). The README is written for a stranger self-hosting it: what it is, a compose quickstart, the settings, how a workshop uploads.
- **Multilingual:** German and English from the start through portfolio's copy system (`components/copy/{de,en}.ts`, a test that both have the same keys), pages under `app/[lang]/` with the language picked in `proxy.ts` and never in the URL (`code/language.md`); adding a language is adding one copy file. A customer has a `language` (`de` | `en`, default `de`) that Marcel sets: the customer page opens in it unless the visitor picked another with the language switch.
- Customer pages: no download button, no `<a href>` to a file, no cookies unless the visitor uses the language switch (then only the language cookie), `X-Robots-Tag: noindex, nofollow` and `<meta name="robots" content="noindex">`, no third-party requests (fonts self-hosted as in portfolio).
- An unknown, revoked or replaced token, and a model or file that is not the token's customer's, answer the identical 404 page.
- Link tokens: 24 random bytes, base64url (32 chars), from `node:crypto`, stored in clear (Marcel copies a customer's link from the admin page at any time; the database file is 0600). Revoking deletes it; renewing replaces it. Compare with a constant-time lookup by unique index, never by scanning.
- The OpenSCAD source is never uploaded: the upload route accepts only `.3mf` (model), `.png` (preview), and `.png`/`.svg`/`.pdf` (drawings).
- UI: German default, English second (portfolio's copy system, `components/copy/{de,en}.ts`); tool descriptions, logs, code in English.
- Upload size limit `PREVIEW_MAX_UPLOAD_MB`, default 100.

## Review Focus

1. A token renewed: the old link answers 404 at once, the new one works (test in Task 5).
2. Customer A's token with customer B's model id or version id in the URL: 404, not B's model (Task 5 and Task 6).
3. A file named `x.3mf` that is not a zip with `3D/3dmodel.model`: refused with 400 and nothing stored (Task 3).
4. A 3MF with several objects and per-object colours (the QR keychain, `parametric-qr-code-keychain.3mf`): shown whole and coloured (Task 7 e2e fixture).
5. A customer list page on a phone on mobile data: loads only the preview PNGs, no 3MF until a model is opened (Task 6 test asserts no `.3mf` request on `/k/<token>`).

---

### Task 1: Scaffold the repository from portfolio

**Files:**
- Create: repository `3D-Bruckner/preview` (private until first release, then per `repo-setup/where-a-repo-lives.md` and `cla.md` as portfolio is: public, AGPL-3.0-only).
- Copy from portfolio unchanged in shape: `.dockerignore .editorconfig .gitignore .npmrc .nvmrc .prettierignore .prettierrc.json CLA.md CONTRIBUTING.md SECURITY.md LICENSE Dockerfile docker-entrypoint.mjs eslint.config.mjs next.config.ts postcss.config.mjs tsconfig.json vitest.config.mts playwright.config.ts instrumentation.ts proxy.ts proxy.test.ts .github/**`, `app/.well-known/**`, `app/api/auth/**`, `app/api/language/**`, `app/api/test/sign-in/**`, `app/api/v1/[...path]/route.ts`, `app/mcp/route.ts`, `app/health/route.ts`, `app/global-not-found.tsx`, `app/[lang]/layout.tsx`, `app/[lang]/(public)/{layout.tsx,signin/**,consent/**}`, `app/[lang]/(app)/{layout.tsx,NavLinks.tsx,settings/**}`, `app/_lib/**`, `components/{CopyProvider,Dialog,LanguageSwitch,Notice,Tabs,icons,ui,format,useHydrated}.*`, `components/copy/**` (emptied to the shared strings), `backend/{accounts,config,log,health,runtime,outcome,client}.ts` and their tests, `backend/db/{connection,migrations,index,store}.ts`, `backend/testing/**`, `e2e/{app,signin,teardown,scaffold.spec,signin.spec,a11y.spec}.ts`, `scripts/generate-openapi.mjs`.
- Create: `README.md`, `CLAUDE.md` (portfolio's, rewritten for this app), `.env.example`, `compose.yaml`, `docs/{architecture,configuration,mcp}.md`, `docs/adr/0001-a-viewer-of-our-own.md`.

**Interfaces:**
- Produces: `Runtime` (portfolio's, minus portfolio's domain fields), `loadConfig()` with `PREVIEW_DATA_DIR`-relative paths, `rt.db` (kysely), `rt.config.maxUploadMb: number`, `rt.person(headers)`, `rt.apiCaller(req)`, `Outcome<T>` with `ok/notFound/invalid/conflict`.

- [ ] **Step 1:** Create the repo, copy the files above, rename every `portfolio`/`PORTFOLIO_`/`upload` identifier to `preview`/`PREVIEW_`; strip portfolio's domain (prints, photos, categories, add-ons, order, site, sources, bridge, enhance, translate, pricing) from runtime, config, MCP instructions, copy, nav.
- [ ] **Step 2:** Run `npm ci && npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass, `/health` 200 in `npm start`.
- [ ] **Step 3:** Run `npm run test:e2e -- scaffold signin a11y`. Expected: pass (dev user sign-in, axe clean on signin and settings).
- [ ] **Step 4:** Add the brand settings to `backend/config.ts` with tests (defaults neutral, accent colour validated as hex, logo path inside `DATA_DIR`). Write `docs/adr/0001-a-viewer-of-our-own.md` (MADR): options Playground MCP App, Manyfold multi-user (tested 2026-11-27, 0.154.4: works, rejected for looks and for "view" allowing download), Go, own Next.js app; chosen the last. Commit `Scaffold preview from portfolio`.

### Task 2: Customers, models and versions in the database

**Files:**
- Create: `backend/db/schema.ts`, migration `0001_models` in `backend/db/migrations.ts`, `backend/customers.ts`, `backend/models.ts`, `backend/versions.ts`, tests next to each.

**Interfaces:**
- Produces:
  - Tables: `customers(id text pk, name text not null, note text, language text not null default 'de', link_token text unique null, created_at)`, `models(id text pk, customer_id fk, title text not null, description text, created_at, updated_at)`, `versions(id text pk, model_id fk, number int not null, note text, threemf_file text not null, preview_file text not null, created_at, unique(model_id, number))`, `drawings(id text pk, version_id fk, file text not null, kind text check in ('png','svg','pdf'), position int)`.
  - `type Customer = { id; name; note: string|null; language: "de" | "en"; link: string|null; createdAt }` (`link` is the token or null when revoked).
  - `createCustomer(rt, { name: string; note?: string; language?: "de" | "en" }): Outcome<Customer>` — makes a token. `updateCustomer(rt, id, { name?; note?; language? }): Outcome<Customer>`.
  - `listCustomers(rt): Customer[]`, `getCustomer(rt, id): Outcome<Customer>`.
  - `renewLink(rt, customerId): Outcome<Customer>` (new token, old one gone), `revokeLink(rt, customerId): Outcome<Customer>` (token null).
  - `customerByToken(rt, token: string): Customer | null` — the one gate for every customer read.
  - `createModel(rt, { customerId; title; description? }): Outcome<Model>`, `updateModel(rt, id, { title?; description? }): Outcome<Model>`, `listModels(rt, { customerId? }): Model[]`, `getModel(rt, id): Outcome<Model>`.
  - `listVersions(rt, modelId): Outcome<Version[]>` newest first; `type Version = { id; modelId; number; note; createdAt; drawings: { id; kind }[] }`.

- [ ] **Step 1: Write the failing tests** — `customers.test.ts`: `createCustomer` gives a 32-char base64url `link`; two customers get different links; `renewLink` changes `link` and `customerByToken(old)` is null; `revokeLink` sets `link` null and `customerByToken(old)` is null; empty name → `invalid`. `models.test.ts`: `createModel` for an unknown customer → `not_found`; `listModels({customerId})` returns only that customer's. `versions.test.ts`: `listVersions` of an unknown model → `not_found`, else newest first.
- [ ] **Step 2:** Run `npx vitest run backend/customers.test.ts backend/models.test.ts backend/versions.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement schema, migration and the functions above; ids as portfolio makes them; token with `randomBytes(24).toString("base64url")`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `Customers, models and versions`.

### Task 3: Storing a version's files

**Files:**
- Create: `backend/files.ts`, `backend/files.test.ts`, fixtures `backend/fixtures/{ramp.3mf,keychain.3mf,preview.png,not-a-3mf.3mf}` (`ramp.3mf` and `keychain.3mf` from `Parametric-3D-Models`: `rampe-ursel/Rampe-Ursel-cutout.3mf`, `parametric-qr-code-keychain/parametric-qr-code-keychain.3mf`).

**Interfaces:**
- Consumes: Task 2's tables, `next-app-kit/multipart`'s file type.
- Produces:
  - `addVersion(rt, modelId, { threemf: UploadedFile; preview: UploadedFile; drawings: UploadedFile[]; note?: string }): Promise<Outcome<Version>>` — numbers the version max+1, moves files into `DATA_DIR/files/<modelId>/<versionId>/`, all or nothing.
  - `versionFile(rt, versionId, kind: "3mf" | "preview" | { drawing: string }): Outcome<{ path: string; type: string }>`.
  - `UPLOAD_TYPES` for `readMultipart`.

- [ ] **Step 1: Write the failing tests** — `addVersion` with ramp.3mf + preview.png → version 1, files on disk; again → version 2; `not-a-3mf.3mf` → `invalid` "not a 3MF" and no row, no folder; a preview that isn't a PNG → `invalid`; a drawing `.exe` → `invalid`; unknown model → `not_found`.
- [ ] **Step 2:** Run `npx vitest run backend/files.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement; a 3MF is valid when it unzips (fflate `unzipSync` on the first entries only) and has `3D/3dmodel.model`; PNG by magic bytes; SVG by `<svg` root; PDF by `%PDF-`.
- [ ] **Step 4:** Run it. Expected: PASS. Commit `Store a version's files`.

### Task 4: The upload route

**Files:**
- Create: `app/api/models/[id]/versions/route.ts`, `app/api/models/[id]/versions/upload.ts`, `upload.test.ts`.

**Interfaces:**
- Consumes: `addVersion`, `rt.person`, `rt.apiCaller`.
- Produces: `POST /api/models/{id}/versions`, multipart fields `model` (one .3mf), `preview` (one .png), `drawing` (0–10), `note` (text). 201 with the version JSON (`{ id, number, note, link }` where `link` is `${PUBLIC_URL}/k/<token>/<modelId>`), 401 without session or token, 403 for a read token, 404 unknown model, 400 refused file, 413 too large.

- [ ] **Step 1: Write the failing tests** (as portfolio's `upload.test.ts`): each status above, and a successful upload returns `link` to the customer page.
- [ ] **Step 2:** Run `npx vitest run app/api/models`. Expected: FAIL.
- [ ] **Step 3:** Implement as portfolio's `upload.ts` (cleanup in `finally`, refusal texts from copy).
- [ ] **Step 4:** Run it. Expected: PASS. Commit `Upload a version`.

### Task 5: MCP tools and the REST mirror

**Files:**
- Create: `backend/mcp.ts`, `backend/rest.ts`, `backend/shapes.ts`, `backend/mcp.test.ts`, `backend/rest.test.ts`; regenerate `openapi.json`; `docs/mcp.md`.

**Interfaces:**
- Produces tools (and REST ops naming them): `list_customers` (GET /customers), `create_customer` (POST /customers, with `language`), `update_customer` (PATCH /customers/{id}), `get_customer` (GET /customers/{id}, includes `link_url`), `renew_link` (POST /customers/{id}/link), `revoke_link` (DELETE /customers/{id}/link), `list_models` (GET /models?customer=), `create_model` (POST /models), `update_model` (PATCH /models/{id}), `list_versions` (GET /models/{id}/versions). Every customer and model result carries `link_url` (`${PUBLIC_URL}/k/<token>` or `/k/<token>/<modelId>`, null when revoked) and `admin_url`. Plus the kit's token tools as portfolio has them.
- MCP instructions say: versions are uploaded with the REST multipart route (`POST /api/models/{id}/versions`) from the workshop, not over MCP; every version is visible on the customer's link at once.

- [ ] **Step 1: Write the failing tests** — `rest.test.ts`: `checkOpsMirrorTools` passes; a read token gets 403 on POST /customers; `mcp.test.ts`: `create_customer` returns `link_url` and guidance naming `create_model`; `renew_link` guidance says the old link stopped working; `revoke_link` then `get_customer` → `link_url` null.
- [ ] **Step 2:** Run `npx vitest run backend/mcp.test.ts backend/rest.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as portfolio's `mcp.ts`/`rest.ts` (guidance only in MCP results; REST plain data).
- [ ] **Step 4:** Run it, then `npm run generate` and commit `openapi.json`. Expected: PASS. Commit `MCP tools and REST`.

### Task 6: Customer pages and their files

**Files:**
- Create: `app/[lang]/(customer)/k/[token]/page.tsx`, `app/[lang]/(customer)/k/[token]/[model]/page.tsx`, `app/[lang]/(customer)/layout.tsx` (brand header, footer with imprint/privacy links when set, language switch), `app/k/[token]/files/[version]/[file]/route.ts`, `backend/customerview.ts` (+ test), `e2e/customer.spec.ts`.
- Modify: `proxy.ts` (on `/k/<token>…` without a language cookie, rewrite to the customer's `language`, looked up through a small `backend` function, instead of `Accept-Language`; set no cookie there).

**Interfaces:**
- Consumes: `customerByToken`, `listModels`, `listVersions`, `versionFile`.
- Produces: `customerView(rt, token): { customer: { name }; models: { id; title; description; latest: { number; previewUrl } }[] } | null`; `customerModel(rt, token, modelId): { model; versions: { number; note; createdAt; threemfUrl; previewUrl; drawings: { url; kind }[] }[] } | null`; file route serving only files of the token's customer, `Cache-Control: private, max-age=3600`, `Content-Disposition: inline`.

- [ ] **Step 1: Write the failing tests** — `customerview.test.ts`: unknown token → null; token of A with B's model → null; after `renewLink` the old token → null. `e2e/customer.spec.ts`: `/k/<token>` shows the model tiles with their preview images and makes no request ending in `.3mf` or to the 3MF route; `/k/<bad>` and `/k/<A>/<B's model>` answer 404 with the same body as `/does-not-exist`; responses carry `x-robots-tag: noindex, nofollow`; `document.cookie` is empty and no `set-cookie` header on `/k/` responses until the language switch is used; a customer with `language: en` sees English copy; with `PREVIEW_BRAND_NAME=Test Studio` the header shows "Test Studio" and the page names no 3D Bruckner anywhere; with `PREVIEW_IMPRINT_URL` set the footer links it; page has no element with `download` attribute and no link to `/files/`.
- [ ] **Step 2:** Run `npx vitest run backend/customerview.test.ts && npm run test:e2e -- customer`. Expected: FAIL.
- [ ] **Step 3:** Implement the pages (tiles: preview, title, version number and date; model page: the viewer from Task 7 as a placeholder `<div>` until then, version list with notes, drawings shown inline: PNG/SVG as `<img>`, PDF as a link that opens inline).
- [ ] **Step 4:** Run them. Expected: PASS. Commit `Customer pages`.

### Task 7: The 3D view

**Files:**
- Create: `components/ModelViewer.tsx` (client component), `components/ModelViewer.test.tsx`, `e2e/viewer.spec.ts`.
- Modify: `app/k/[token]/[model]/page.tsx` (use it), `package.json` (`three` pinned exactly, `@types/three`).

**Interfaces:**
- Consumes: `threemfUrl` from Task 6.
- Produces: `<ModelViewer src={threemfUrl} label={title} />`.

- [ ] **Step 1: Write the failing tests** — unit: renders a loading state and a reset button with an accessible name; e2e (headless Chromium has WebGL): opening the ramp shows a canvas whose centre pixel is not the background colour after load; opening the keychain fixture shows at least two distinct non-background colours; the reset button restores the camera; with `prefers-reduced-motion: reduce` there is no auto-rotation.
- [ ] **Step 2:** Run `npx vitest run components/ModelViewer.test.tsx && npm run test:e2e -- viewer`. Expected: FAIL.
- [ ] **Step 3:** Implement with `three/examples/jsm/loaders/3MFLoader` and `OrbitControls` (touch rotate/zoom/pan), light background and accent from 3dbruckner.de's palette (take colours and fonts from `3D-Bruckner/3dbruckner`), hemisphere + directional light, a soft ground shadow, fit-to-view on load (bounding sphere), reset button, Z-up 3MF turned to Y-up, renderer disposed on unmount, `devicePixelRatio` capped at 2.
- [ ] **Step 4:** Run them. Expected: PASS. Commit `3D view`.

### Task 8: Admin pages

**Files:**
- Create: `app/[lang]/(app)/page.tsx` (customers), `app/[lang]/(app)/customers/[id]/page.tsx`, `app/[lang]/(app)/models/[id]/page.tsx` (versions + manual upload form posting to Task 4's route), `actions.ts`, copy entries, `e2e/admin.spec.ts`.

**Interfaces:**
- Consumes: Task 2 functions, Task 4 route.

- [ ] **Step 1: Write the failing e2e test** — signed in as the dev user: create a customer, copy-link button puts `/k/<token>` on the clipboard, create a model, upload ramp.3mf + preview, the customer page then shows it; renew changes the shown link; revoke shows "no link" and the old link 404s; signed out, every admin page redirects to sign-in.
- [ ] **Step 2:** Run `npm run test:e2e -- admin`. Expected: FAIL.
- [ ] **Step 3:** Implement with server actions calling the domain (no logic in `app/`).
- [ ] **Step 4:** Run it and `npm run test:e2e -- a11y` (add the new pages to its list). Expected: PASS. Commit `Admin pages`.

### Task 9: Docs and the first release

**Files:**
- Modify: `README.md` (for self-hosters: screenshot of a customer page, quickstart, the workshop flow as one example of an uploader), `docs/configuration.md` (every `PREVIEW_*`, `PUBLIC_URL`, `DATA_DIR`), `docs/adding-a-language.md`, `docs/architecture.md` (one mermaid diagram: workshop → REST upload; customer → /k; Marcel → admin/MCP), `.env.example`, `compose.yaml` (image `ghcr.io/3d-bruckner/preview:main`, port, `data/` volume, healthcheck).

- [ ] **Step 1:** Full check: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e && npm run build`. Expected: all pass.
- [ ] **Step 2:** `grep -rni "bruckner" --exclude-dir=node_modules --exclude-dir=.git . | grep -v -e '^./docs/adr/' -e 'ghcr.io/3d-bruckner/preview' -e 'github.com/3D-Bruckner/preview'` finds nothing (no operator in the product).
- [ ] **Step 3:** Open the PR, CI green, merge on Marcel's word; CI publishes `ghcr.io/3d-bruckner/preview:main`; tag `v0.1.0` per `repo-setup/releases.md`.
