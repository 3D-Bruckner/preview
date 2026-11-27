# MCP tools

preview's MCP server is at `<PUBLIC_URL>/mcp` (Streamable HTTP, POST only), for Claude and any MCP client. A client signs in with OAuth (next-app-kit's: the client registers itself, the person signs in on the app's own sign-in page and agrees on `/consent`); the allowlist (`PREVIEW_ALLOWED_EMAILS`) applies. The tools are in `backend/mcp.ts`.

## How the tools answer

- **The same domain functions as REST and the web app.** Each tool has a REST operation under `/api/v1` that mirrors it (`checkOpsMirrorTools` in `backend/rest.test.ts`).
- **Inputs are camelCase**, the same wire names as REST (`expiresInDays`).
- **Every result carries `guidance`**: English lines, built from what the call did, about what matters next. The tool descriptions say what Claude needs before a call; `guidance` what it needs after.
- **A refusal** is an MCP error with the domain's English message.
- **The server's instructions** (`MCP_INSTRUCTIONS`) say what the app is and that customers never sign in.

## The 3 tools

### API tokens

For scripts, such as a workshop's upload with a `read+write` token. Tokens are made and revoked by an OAuth caller (an MCP client) or in the web app; over REST an API token can't make or revoke tokens (403), so a leaked token can't mint new ones.

| Tool               | Input                                                                             | Returns                                                                             | Guidance says                                                                                        |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `create_api_token` | `name`, `scope` (`read` or `read+write`), `expiresInDays` (1–365, or null: never) | the token's `id`, `name`, `scope`, `start`, dates and the `token` itself, this once | hand it to the person once for their password manager and never repeat it; how to find and revoke it |
| `list_api_tokens`  | none                                                                              | `tokens`: names, scopes, starts and dates, never the tokens                         | a token can't be shown again; `revoke_api_token` takes one back                                      |
| `revoke_api_token` | `id`                                                                              | `revoked`: the id                                                                   | whatever used it now gets 401 and needs a new token                                                  |
