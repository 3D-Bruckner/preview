import { wellKnownHandlers } from "next-app-kit/next";
import { runtime } from "@/app/_lib/runtime";

// The OpenID configuration of the OAuth server at /api/auth (next-app-kit).
export const GET = wellKnownHandlers(() => runtime().auth()).openidConfiguration;
