import { wellKnownHandlers } from "next-app-kit/next";
import { runtime } from "@/app/_lib/runtime";

// RFC 8414 metadata of the OAuth server at /api/auth, which Better Auth can't serve from under its own base path (next-app-kit).
export const GET = wellKnownHandlers(() => runtime().auth()).authorizationServer;
