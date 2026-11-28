# MCP tools

preview's MCP server is at `<PUBLIC_URL>/mcp` (Streamable HTTP, POST only), for Claude and any MCP client. A client signs in with OAuth (next-app-kit's: the client registers itself, the person signs in on the app's own sign-in page and agrees on `/consent`); the allowlist (`PREVIEW_ALLOWED_EMAILS`) applies. The tools are in `backend/mcp.ts`.

## How the tools answer

- **The same domain functions as REST and the web app.** Each tool has a REST operation under `/api/v1` that mirrors it (`checkOpsMirrorTools` in `backend/rest.test.ts`).
- **Inputs are camelCase**, the same wire names as REST (`expiresInDays`, `customerId`). Results are snake_case, as REST answers them.
- **Every result carries `guidance`**: English lines, built from what the call did, about what matters next. The tool descriptions say what Claude needs before a call; `guidance` what it needs after.
- **A refusal** is an MCP error with the domain's English message.
- **The server's instructions** (`MCP_INSTRUCTIONS`) say what the app is, that customers never sign in, and that versions are uploaded with the REST multipart route (`POST /api/models/{id}/versions`) from the workshop, not over MCP; every version is visible on the customer's link at once.
- **Links.** Every customer and model result carries `link_url` (`<PUBLIC_URL>/k/<token>` for a customer, `/k/<token>/<modelId>` for a model; null once the customer's link is revoked) and `admin_url` (`/customers/<id>`, `/models/<id>` in the web app).

## The 19 tools

### Customers

| Tool              | Input                                                  | Returns                                           | Guidance says                                             |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| `list_customers`  | none                                                   | `customers` by name, each with `link_url`         | `create_customer` when there are none                     |
| `create_customer` | `name`, `note?`, `language?` (`de` default, or `en`)   | the customer, with `link_url`                     | send them the link; `create_model` adds their first model |
| `update_customer` | `id`, any of `name`, `note` (empty clears), `language` | the customer                                      | the link is the same as before                            |
| `get_customer`    | `id`                                                   | the customer, with `link_url` (null when revoked) | renew or revoke the link                                  |
| `renew_link`      | `id`                                                   | the customer with the new `link_url`              | the old link stopped working; send the new one            |
| `revoke_link`     | `id`                                                   | the customer, `link_url` null                     | nobody can open their page until `renew_link`             |

### Models and versions

| Tool              | Input                                                             | Returns                                                                                        | Guidance says                                                                                     |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `list_models`     | `customerId?`                                                     | `models`, newest first, each with `link_url` and `admin_url`                                   | `create_model` when there are none; `list_versions` for a model's versions                        |
| `create_model`    | `customerId`, `title`, `description?`                             | the model                                                                                      | upload versions with `POST /api/models/{id}/versions`; its link, or that the link is revoked      |
| `update_model`    | `id`, any of `title`, `description` (empty clears)                | the model                                                                                      | the customer sees it on their next visit                                                          |
| `list_versions`   | `modelId`                                                         | `versions`, newest first: number, note, parts, drawings, `figures`, `slicing`, `slicing_error` | with none, how to upload one; otherwise that the customer sees all of them                        |
| `reread_facts`    | `version_id`                                                      | `parts`: how many the 3MF has                                                                  | how many parts the customer's page lists now                                                      |
| `reslice_version` | `version_id`                                                      | `slicing`: `pending`                                                                           | that the version is back in line for the slicer, and the customer's page says so until it answers |
| `list_filaments`  | `available?`                                                      | `filaments` in picker order: name, material, colour, available, position                       | with none, that the customer sees no pickers; otherwise how many are offered                      |
| `create_filament` | `name`, `material`, `color`, `available?`                         | the filament                                                                                   | whether customers can pick it now                                                                 |
| `update_filament` | `id`, any of `name`, `material`, `color`, `available`, `position` | the filament                                                                                   | whether it is still offered                                                                       |
| `delete_filament` | `id`                                                              | `id`                                                                                           | that customers can no longer pick it; feedback that named it keeps its name and colour            |

### API tokens

For scripts, such as a workshop's upload with a `read+write` token. Tokens are made and revoked by an OAuth caller (an MCP client) or in the web app; over REST an API token can't make or revoke tokens (403), so a leaked token can't mint new ones.

| Tool               | Input                                                                             | Returns                                                                             | Guidance says                                                                                        |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `create_api_token` | `name`, `scope` (`read` or `read+write`), `expiresInDays` (1–365, or null: never) | the token's `id`, `name`, `scope`, `start`, dates and the `token` itself, this once | hand it to the person once for their password manager and never repeat it; how to find and revoke it |
| `list_api_tokens`  | none                                                                              | `tokens`: names, scopes, starts and dates, never the tokens                         | a token can't be shown again; `revoke_api_token` takes one back                                      |
| `revoke_api_token` | `id`                                                                              | `revoked`: the id                                                                   | whatever used it now gets 401 and needs a new token                                                  |
