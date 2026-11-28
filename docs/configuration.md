# Configuration

Every setting is an environment variable, and on a server every one of them is in one `.env` file: a filled-in copy of [`.env.example`](../.env.example), `chmod 600`, each value also in your password manager. `compose.yaml` lists none of them. A bad value stops the start with a message naming the variable.

Three files name the same variables and change together: `backend/config.ts` (`loadConfig` and its `VARIABLES` list), `.env.example` and this page. `envExampleListsEveryVariable` in `backend/config.test.ts` fails when one of them names a variable the others don't, or when code reads `process.env.X` for an `X` none of them lists.

An empty value counts as unset, so a copied `.env.example` with a blank line keeps the default. A variable whose empty value would still change something (`DATA_DIR`, `PORT`, an OIDC block) stays commented out in `.env.example` until it is filled in.

## The app

| Variable                 | Required | Default                | What it does                                                                                                                                                                                                            |
| ------------------------ | -------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`             | yes      |                        | The app's public URL, such as `https://preview.example.com`: links in sign-in mails and MCP results, the customers' links, the issuer of OAuth tokens. A trailing `/` is dropped.                                       |
| `PREVIEW_SECRET`         | yes      |                        | At least 32 random characters (`openssl rand -base64 48`) that sign sessions and tokens. Changing it signs everyone out.                                                                                                |
| `PREVIEW_ALLOWED_EMAILS` |          | empty: nobody          | Who may sign in: addresses and `@domain` entries, comma-separated, case ignored. An address taken off the list loses its sessions and MCP grants at the next start. Customers never sign in: they only open their link. |
| `PREVIEW_MAX_UPLOAD_MB`  |          | `100`                  | The largest upload a request may send, in whole megabytes (at least 1): a version's 3MF, its preview and its drawings together (and none of them alone may be larger). A larger one is refused with 413.                |
| `PREVIEW_LOG_LEVEL`      |          | `info`                 | The log's level: `debug`, `info`, `warn`, `error` or `silent` (read by `backend/log.ts`). The log is JSON on stdout and never holds a token, a link token, a file's name or an email address.                           |
| `DATA_DIR`               |          | `/data` (in the image) | Where the data lives (below).                                                                                                                                                                                           |
| `TZ`                     |          | `UTC`                  | The time zone of the log's and the app's dates, such as `Europe/Berlin`.                                                                                                                                                |

## The brand

preview names no one by itself: whoever runs an instance puts their own name, colour, logo and legal links here. Every one is optional.

| Variable               | Default        | What it does                                                                                                                                                                                         |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREVIEW_BRAND_NAME`   | `Preview`      | The name in every page's header and title, and the Home Screen's name. At most 80 characters.                                                                                                        |
| `PREVIEW_BRAND_URL`    | none: no link  | Where the header's name links to, such as your website (`http` or `https`).                                                                                                                          |
| `PREVIEW_ACCENT_COLOR` | `#1d4ed8`      | The accent colour, as hex (`#1d4ed8` or `#15c`): buttons, the current menu item, the focus ring. It must stay readable as text on white (4.5:1, WCAG AA); the dark mode lightens it by itself.       |
| `PREVIEW_LOGO`         | none: the name | Your logo for the header: an `.svg` or `.png` file inside `DATA_DIR`, given relative to it (`brand/logo.svg`) or as an absolute path inside it. A path that leads out of `DATA_DIR` stops the start. |
| `PREVIEW_IMPRINT_URL`  | none: no link  | The footer's link to your imprint, on every page. Operators in Germany need it (and the next one).                                                                                                   |
| `PREVIEW_PRIVACY_URL`  | none: no link  | The footer's link to your privacy policy, on every page.                                                                                                                                             |

## Print figures

A 3MF that Bambu Studio has sliced carries its print time, weight and grams per filament, and preview reads them from the file. For any other 3MF (a workshop's export, a plain 3MF) preview asks a slicing service (`3D-Bruckner/slicing`'s `POST /estimate`), one file at a time, in the background; the customer's page says "wird berechnet" until it answers. A busy or limited service (429, 503, 504) is asked again with backoff, at most 5 times over about an hour; a refusal (400, 413, 422) is final, and the web app offers to try again.

| Variable                  | Default | What it does                                                                                                       |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `PREVIEW_SLICER_URL`      | none    | The slicing service's base URL. Unset: files without their own figures show none; nothing else changes.            |
| `PREVIEW_SLICER_TOKEN`    | none    | Sent as `Authorization: Bearer`; the service's token lifts its hourly limit (10 files an hour per caller without). |
| `PREVIEW_SLICER_MATERIAL` | `PLA`   | `PLA` or `PETG`: what a file is sliced in when its first part's filament is neither.                               |

## Feedback

A customer can send feedback on a version from their page: a comment (up to 2000 characters) and a colour wish per part, picked from the filaments the operator offers (settings, or `create_filament`). A customer may send 10 an hour and 50 a day. The web app lists it under the version; MCP and REST answer it with `list_feedback`.

| Variable                 | Default | What it does                                                                                                                                                                          |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREVIEW_FEEDBACK_EMAIL` | none    | Where each feedback is mailed (in German: model, version, the wishes, the comment, a link into the web app), through `PREVIEW_SMTP_URL` and from `PREVIEW_SMTP_FROM`. Unset: no mail. |

## Sign-in (read by next-app-kit)

next-app-kit's `signInFromEnv` reads these under the prefix `PREVIEW` (`backend/accounts.ts`). Some way in must exist: SMTP, a provider, or (in development) a dev user.

| Variable                                                                                                                        | What it does                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREVIEW_SMTP_URL`, `PREVIEW_SMTP_FROM`                                                                                         | Sign-in by email: a code, and in the browser a link too, sent through this SMTP server (`smtps://user:password@host:465`), from an address such as `Preview <noreply@example.com>`. The mail speaks the sign-in page's language.                                     |
| `PREVIEW_OIDC_<NAME>_CLIENT_ID`, `PREVIEW_OIDC_<NAME>_CLIENT_SECRET`, `PREVIEW_OIDC_<NAME>_ISSUER`, `PREVIEW_OIDC_<NAME>_LABEL` | A sign-in provider. `GITHUB`, `GOOGLE` and `APPLE` are built in and need no issuer; any other name is an OIDC provider and needs `_ISSUER`, its discovery base. `_LABEL` is the button's name. The allowlist applies to every provider.                              |
| `PORT`                                                                                                                          | **Must be the port the server really listens on** (the image sets `3000`). /mcp and /api/v1 check OAuth access tokens against the app's own key set at `http://127.0.0.1:$PORT/api/auth/jwks`; with a wrong port every MCP call answers 401 (API tokens still work). |
| `PREVIEW_E2E`                                                                                                                   | `1` turns on the end-to-end tests' sign-in route (`/api/test/sign-in`), outside production only; under `NODE_ENV=production`, as in the image, the route doesn't exist. Never set on a server.                                                                       |
| `PREVIEW_DEV_USER`                                                                                                              | Development only: everyone reaching the app is this address, without signing in. Refused when `NODE_ENV=production`, as in the image.                                                                                                                                |

## The image

| Variable              | Default                                    | What it does                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUID`, `PGID`        | the owner of `/data` (1000 if that's root) | Who the server runs as. The entrypoint (`docker-entrypoint.mjs`) starts as root only to give `DATA_DIR` itself to this user and switch to it; the files in it are never chowned.                                                      |
| `NODE_EXTRA_CA_CERTS` | none                                       | A PEM file of extra certificate authorities to trust, for an SMTP server or proxy with an internal CA. The image is distroless (no shell, no `update-ca-certificates`), so this is the way to add one: mount the file and point here. |

The standalone server must bind a non-loopback `HOSTNAME`: bound to `127.0.0.1`, the proxy's rewrites proxy to the server itself and pages hang. The image itself sets `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0` and `DATA_DIR=/data`, and runs Node with `--use-system-ca`.

**An API token from the server**, without a browser (the first one, or one for a script such as a workshop's upload): next-app-kit's command, run in the container as its user, for an address in `PREVIEW_ALLOWED_EMAILS` (also one that never signed in). It prints the token once:

```sh
docker exec -u 1000 preview /nodejs/bin/node node_modules/next-app-kit/dist/cli.js token \
  --prefix PREVIEW --token-prefix preview_ --email you@example.org --name "workshop upload" --scope read+write --days 365
```

## The data

Everything preview keeps is in `DATA_DIR`:

```text
DATA_DIR/
  preview.sqlite   the customers, their models and the models' versions
  auth.sqlite      next-app-kit's: people, sessions, API tokens, MCP clients and grants
  files/<model>/<version>/   a version's model.3mf, preview.png and drawings
  (your logo, if PREVIEW_LOGO points into DATA_DIR)
```

The entrypoint runs with umask 077: the databases (with their `-wal` and `-shm`) and the uploaded files are mode 0600, their folders 0700, readable by the server's user alone.

**A backup needs all of it**: both SQLite files, copied with `sqlite3 <file> ".backup <copy>"` (not `cp`) while the app runs, and every file beside them.
