import { runtime } from "@/app/_lib/runtime";
import { healthResponse } from "@/backend";

// What Docker's health check and Playwright wait for; outside app/[lang], so the proxy leaves it alone.
export const dynamic = "force-dynamic";

export function GET() {
  const { status, body } = healthResponse(runtime());
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
