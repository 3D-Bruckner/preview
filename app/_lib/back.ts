import { safeNext } from "next-app-kit/signin";

const YEAR = 365 * 24 * 60 * 60;

// The header's switches (language, theme) post a plain form and send the browser back where it came from: its Referer, a path of this app
// only (safeNext), else the start page. The choice goes into a year-long cookie that only the server reads.
export function switchedBack(req: Request, cookie: string, value: string): Response {
  const referer = req.headers.get("referer");
  let back = "/";
  try {
    if (referer) {
      const url = new URL(referer);
      back = safeNext(url.pathname + url.search);
    }
  } catch {
    // not a URL: back to the start page
  }
  return new Response(null, {
    status: 303,
    headers: { location: back, "set-cookie": `${cookie}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax; HttpOnly`, "cache-control": "no-store" },
  });
}
