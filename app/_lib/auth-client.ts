"use client";
// Better Auth's browser client, copied from next-app-kit's examples/minimal (README, "The sign-in page"). It holds no token: the session is
// an HttpOnly cookie. emailOTPClient sends and checks the code, and oauthProviderClient carries a
// sign-in or consent page's signed query along, so an MCP client's authorize step continues after it (and its mail holds only the code).
// OIDC providers need no plugin: authClient.signIn.social takes their ids. The link in the mail is the kit's, so no magicLinkClient.
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ basePath: "/api/auth", plugins: [emailOTPClient(), oauthProviderClient()] });
