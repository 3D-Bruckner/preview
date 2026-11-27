import { wellKnownHandlers } from "next-app-kit/next";
import { runtime } from "@/app/_lib/runtime";

// RFC 9728 metadata of /mcp and /api/v1: where an MCP client or a script finds the server to sign in at (next-app-kit).
export const GET = wellKnownHandlers(() => runtime().auth()).protectedResource;
