import { mcpHandler } from "next-app-kit/next";
import { mcpContext } from "@/backend";
import { runtime } from "@/app/_lib/runtime";

// /mcp (next-app-kit): the tools of backend/mcp.ts over Streamable HTTP, POST only, for OAuth access tokens issued for /mcp.
export const { POST, GET, DELETE } = mcpHandler(() => mcpContext(runtime()));
