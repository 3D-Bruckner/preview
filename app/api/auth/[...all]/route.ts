import { authHandler } from "next-app-kit/next";
import { runtime } from "@/app/_lib/runtime";

// Better Auth (next-app-kit): sign-in by provider (or code and link, when mail is set up), sessions, and the OAuth server MCP clients and scripts sign in through.
export const { GET, POST } = authHandler(() => runtime().auth());
