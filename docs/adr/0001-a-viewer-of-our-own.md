---
status: accepted
date: 2026-11-27
decision-makers: Marcel Bruckner
---

# Customers see their models in a viewer of our own: a Next.js app on next-app-kit, open source from the first commit

## Context and Problem Statement

A workshop designs 3D models for its customers and iterates on them: each model goes through versions ("2 cm wider"). A customer should see the models made for them, in a large interactive 3D view on their phone, with the versions and their notes and any drawings, and say whether it fits. They should never see another customer's models, the models' source or anything else of the workshop's, and they should not get a button to download the file. They need no account: one secret link per customer, which the workshop can revoke or renew.

The workshop uploads each version from a script (the 3MF, a preview image, the drawings) and manages its customers and their links from Claude and from a browser. The design is [`docs/superpowers/specs/2026-11-27-preview-design.md`](../superpowers/specs/2026-11-27-preview-design.md).

## Decision Drivers

- The customer's page looks like a finished product, in the workshop's look, not like a file manager.
- View only: no download button and no link to a file on the customer's page.
- One secret link per customer; no customer accounts.
- Upload from a script over an API; management over MCP (conventions: MCP first) and in a browser.
- Sign-in, API tokens and OAuth for MCP clients are not written again (conventions: Sign-in).
- Little to run: one process, one image, SQLite (conventions: Next.js app, SQLite).

## Considered Options

1. The OpenSCAD Playground and its MCP App: OpenSCAD in the browser, driven by Claude inside the chat.
2. Manyfold in multi-user mode as the customer's view.
3. A viewer of our own in Go.
4. **A viewer of our own as a Next.js app on next-app-kit.**

## Decision Outcome

Chosen: option 4, by Marcel.

- **The Playground** keeps the model in the browser: nothing is stored on a server, there are no customer links, and its MCP App was not tested in the real Claude app.
- **Manyfold** was tested on 2026-11-27 with a temporary instance (0.154.4): per-user view permission, a private default, upload over its API and the 3MF view all work. It was rejected for its looks and its rights: it looks like a file manager, its theming is limited to 25 Bootswatch themes without custom CSS and its viewer keeps a black and cyan grid; its "view" permission also allows downloading, and its API can't share a model.
- **Go** would be lighter (roughly 15–30 MB of memory against 100–200 MB, typical values, not measured), but would write sign-in, API tokens and MCP's OAuth again, which next-app-kit already gives, against the conventions.
- **Next.js on next-app-kit** reuses all of that and is built like `3D-Bruckner/portfolio`, which the repository was scaffolded from: the same layout, Dockerfile, CI, sign-in, copy system and tooling, with portfolio's domain taken out.

Open source from the first commit, under AGPL-3.0-only with portfolio's contributor licence agreement: the product names no operator. Everything that does (the brand's name, link, accent colour and logo, the imprint and privacy links) is a setting with a neutral default (`PREVIEW_BRAND_*`, `PREVIEW_ACCENT_COLOR`, `PREVIEW_LOGO`, `PREVIEW_IMPRINT_URL`, `PREVIEW_PRIVACY_URL`; [configuration](../configuration.md)); a workshop's own values live only in its deployment. The UI speaks German and English from the start (German by default), through portfolio's copy modules; another language is one more copy file.

### Consequences

- Good, because the customer's page can look exactly as the workshop wants, with no download button and nothing of a file manager.
- Good, because sign-in, API tokens, MCP, REST, migrations and multipart uploads come from next-app-kit, as in portfolio: a fix there reaches both apps.
- Good, because anyone can run it for their own workshop: no operator's name or look is built in.
- Bad, because it is one more app to keep up to date, with Next.js's and the kit's releases.
- Bad, because a Next.js process takes more memory than a Go one would (estimated, not measured).
- Bad, because the customer's browser has to load the 3MF to show it, so a determined customer can still save it from the browser; that is accepted, with no reduced preview mesh.
