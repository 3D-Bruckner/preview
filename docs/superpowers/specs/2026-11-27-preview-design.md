# SCAD workshop and customer model viewer: design

Date: 2026-11-27. Status: draft for Marcel's approval.

## Intent

Claude designs 3D models for 3D Bruckner's customers. Marcel is often away: he talks to Claude from his phone, sends photos, sketches and ideas, and Claude writes the OpenSCAD code, renders it, looks at its own renders and iterates. When a design is ready, the customer gets a link to a good-looking, view-only 3D page of the models made for them and says whether it fits. Nobody but Claude and Marcel edits a model; customers only look.

Two parts:

1. **The workshop** (homelab, CT 125 `3d-printing`): a Claude Code that runs permanently, OpenSCAD, and a checkout of the parametric models repository.
2. **The viewer** (`vorschau.3dbruckner.de`, products-1): a small Next.js app that holds the rendered models per customer and shows them behind a secret link.

## Goals

- Marcel can start and steer design work from the Claude app on his phone, with images, without his laptop.
- Claude can render any model headless (3MF/STL and PNG views from chosen angles) and look at the result itself.
- Every customer has one secret link to a page with their models: a large interactive 3D view (rotate, zoom by touch), versions with a short note, optional drawings, in 3D Bruckner's look.
- Claude publishes a version to the viewer in one call from the workshop.
- The models' source stays in git (GitHub), not in the viewer.

## Non-goals (v1)

- Editing in the browser, a customizer for customers, or customers changing parameters.
- Customer accounts or passwords.
- Feedback buttons or comments in the viewer: customers answer through the usual channel (mail, messenger).
- Slicing or print files with print settings (Bambu Studio / Bambuddy do that).
- Export to Bambuddy (needs ADR-0276 changed: print-bridge is the only Bambuddy client) and to the home Manyfold. Both are follow-ups.
- A live view of the work in progress: during work Claude sends renders into the chat; the viewer shows published versions.

## Anti-goals

- The customer page must never expose the OpenSCAD source, other customers' models or anything of Marcel's private library.
- The viewer must not look like a file manager (the reason Manyfold was rejected).
- No second service next to the app (conventions: Next.js app, one process).

## Constraints

- Engineering conventions apply to the viewer: one Next.js app in one image, MCP first over a framework-free `backend/`, SQLite, Better Auth through next-app-kit, `zod` at boundaries, German and English UI text per the language convention.
- Business services do not run at home and no visitor request reaches home (ADR-0220, ADR-0276): the viewer runs on products-1, Caddy on gewerbe-1 is the public entry, deployment through the private business deploy repository as for `portfolio`.
- CT 125 has 2 GiB RAM and 4 cores today; RAM is a fixed host budget (~28 GiB, ADR-0219): check `free -h` on the host before raising it.
- Guests are OpenTofu's (ADR-0201): the RAM change goes through `tofu/tofu.sh plan/apply`, not `pct set`. Host config and packages go through Ansible (`roles/` for the `printing` group).
- CT 125 backs up only `/data` and `/srv/samba`: the checkout lives under `/data`.

## Approaches considered

| Approach | What it is | Why not / why |
|---|---|---|
| OpenSCAD Playground + its MCP App | Official OpenSCAD in the browser; an MCP App that lets Claude drive it inside the chat | Code lives in the browser, nothing on the server, no customer links, not tested in the real Claude app. Rejected. |
| Claude Code + Manyfold (multi-user) as the customer view | Tested 2026-11-27 with a temporary instance (0.154.4): per-user view permission, private default, API upload and 3MF view all work | Works, but looks like a file manager; theming is limited to 25 Bootswatch themes, no custom CSS, and the viewer keeps its black/cyan grid. "View" also allows download; the API can't share. Rejected for looks. |
| Own viewer in Go | Same app, lighter (≈15–30 MB vs ≈100–200 MB RAM, typical values, not measured) | Rewrites sign-in, tokens and MCP OAuth that next-app-kit already gives; against the conventions. Rejected by Marcel. |
| **Claude Code workshop + own Next.js viewer (chosen)** | Claude Code and OpenSCAD on CT 125, a small next-app-kit app on products-1 | Looks the way 3D Bruckner wants, reuses the kit, follows the conventions. |

## Part 1: the workshop on CT 125

- **OpenSCAD**: a recent build with the Manifold backend, installed by Ansible in the `printing` group's role, headless (PNG export without a display; `xvfb-run` if the build needs it). Builder: pick the build (Debian's 2021 package is too old for Manifold; an official nightly/snapshot or AppImage), pin it.
- **The repository**: `Parametric-3D-Models`, moved from `Marceltov` to the `3D-Bruckner` organization (business work belongs in the product org, conventions "Where a repository lives"; *Claude's call*). Checked out at `/data/scad/Parametric-3D-Models`, one folder per model as today. Push access by a deploy key with write access, the key in 1Password/vault.
- **Claude Code**: installed by Ansible, running as a dedicated user in a tmux session under a systemd unit, working directory the checkout, Remote Control on, so Marcel talks to it from the Claude app. Logged in once interactively with Marcel's account. Its `CLAUDE.md` in the models repository says how to render, where outputs go and how to publish.
- **Rendering**: a script in the models repository (`scripts/render`) that renders a model to 3MF and PNG views (front, side, top, isometric) into a git-ignored `out/` folder; Claude reads the PNGs to check its work and sends them to the chat.
- **Publishing**: a script (`scripts/publish`) that creates the customer and model if needed, uploads the rendered 3MF, its preview PNG and optional drawings as a new version over the viewer's REST API, and prints the customer link. Claude sends that link to Marcel in the chat; he reviews in the browser on the same page the customer gets.
- **The key**: one next-app-kit API token (`read+write`, Marcel's, REST only) in the vault, written to the workshop user's environment by Ansible. Accepted risk (Marcel, 2026-11-27): whoever takes over CT 125 can list and change customers, models and links on the viewer; revoking the token in the admin page cuts it off. This is a deliberate exception to ADR-0220's "one narrow thing" rule and goes into the ADR.
- **Session**: one long-running Claude Code session. Before anything else is built, test that photos sent from the Claude app reach a Remote Control session; fallback if not: photos into the models repo's `references/` by another path.
- **Git**: Claude commits and pushes to `main` of the models repository (deploy key with write access); the history is the record.
- **No customer personal data at home**: folders are named by model, never by customer; names and contact details exist only in the viewer. The customer name passes through the publish call but is not stored on CT 125.
- **RAM**: 2 → 4 GiB through OpenTofu, after checking the host's free memory.
- **Monitoring**: the unit's state is watched (a Beszel/Grafana service check, per the `changing-alerts-and-controls` skill); Homelable's CT 125 doc and the Services canvas get the workshop.

## Part 2: the viewer `vorschau.3dbruckner.de`

A new repository `3D-Bruckner/preview` (named by Marcel; the public address is `vorschau.3dbruckner.de`), built like `3D-Bruckner/portfolio` (same layout, Dockerfile, next-app-kit, CI); deployed by a `preview/` folder in `3D-Bruckner/stacks` on products-1, Caddy on gewerbe-1.

### Open source and languages

- Open source from the first commit (AGPL-3.0-only, CLA, as portfolio): the product names no operator. Brand name, link, accent colour, logo and the imprint and privacy links are settings; 3D Bruckner's values live in the business deployment only.
- German and English from the start, more by adding one copy file. Each customer has a language (default German) that their link opens in; the visitor can switch.

### Domain

- **Customer**: name, optional note, a link token (≥128 bits random, URL-safe), revoked flag, created.
- **Model**: belongs to a customer; title, description.
- **Version**: belongs to a model; number, note ("2 cm wider"), the 3MF file, optional drawings (PNG/SVG/PDF), created. The newest version is shown first; older ones stay selectable.
- Files under `DATA_DIR`, metadata in SQLite.

### Surfaces (MCP first)

- **MCP tools** (for the Claude app and Claude Code): `list_customers`, `create_customer`, `customer_link`, `revoke_link` / `renew_link`, `list_models`, `create_model`, `update_model`, `list_versions`. Results carry next-step guidance per the convention.
- **REST** mirrors every tool; uploading a version (`POST /api/v1/models/{id}/versions`, multipart) is REST-only because MCP can't carry the file; the MCP tools say so. The workshop's script uses an API token (REST only, per the sign-in convention).
- **Admin pages** (Marcel, signed in through Better Auth, allowlist): customers with their links (copy, revoke, renew), models and versions, upload by hand as a fallback.
- **Customer pages** (no sign-in, by token): `/k/<token>` lists the customer's models as tiles with a preview; `/k/<token>/<model>` shows the 3D view, the version picker with notes and the drawings. There is no download button and no direct file link on the page (Marcel: the customer "cannot download from there easily"). The browser still loads the 3MF to show it, so a determined customer can save it; that is accepted, no reduced preview mesh. Unknown or revoked tokens get the same 404 as any missing page. `noindex`, no third-party requests, no tracking.

### The 3D view

three.js in the browser with its 3MF loader (colours/multi-part as the 3MF carries them), orbit controls with touch, a light background in 3D Bruckner's colours, soft lighting, a ground shadow, fit-to-view, a reset button. Tile previews are a PNG render uploaded with each version (the workshop renders it), so the list page doesn't load every 3MF. The look follows 3dbruckner.de (builder: take colours and fonts from the site).

### Operations

- Backups as for portfolio: `scripts/dump.sh` copies the database and the files; the business deploy repo schedules them.
- Uptime check on `/health` in the business monitoring.
- Privacy: 3dbruckner.de's privacy policy names the viewer (what is stored: customer name, models; Caddy's access log). The customer pages set no cookies.

## Decisions taken in the conversation

- Workshop on CT 125, Claude Code running there; Marcel talks to it from his phone.
- Customers view only; one secret link per customer instead of accounts.
- Own viewer, not Manyfold; built on Next.js with next-app-kit (not Go).
- Viewer on products-1 at `vorschau.3dbruckner.de`.
- The workshop publishes with a `read+write` key and sends Marcel the customer link; Marcel reviews on the customer's page.
- No download on the customer page; saving the loaded 3MF from the browser is accepted.

## Claude's calls (check while reading)

- Move `Parametric-3D-Models` to `3D-Bruckner`.
- Version upload REST-only; MCP for Marcel's own management from the Claude app.
- Every published version is visible on the link at once (no draft state); a draft flag is a follow-up if Marcel wants to iterate after the customer has the link.
- The existing `claude_code` Ansible role installs Claude Code.
- Tile previews as uploaded PNGs.
- Bambuddy and Manyfold export left for later.

## Left to the builder

- Which OpenSCAD build, and how it's pinned.
- The render script's exact camera angles and image size.
- Database schema and migration details, page layout details within the conventions.
- Whether drawings are PNG, SVG or PDF (accept all three).
