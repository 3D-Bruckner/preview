import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(theme: string, referer?: string) {
  const body = new FormData();
  body.set("theme", theme);
  return POST(new Request("http://localhost/api/theme", { method: "POST", body, headers: referer ? { referer } : {} }));
}

describe("POST /api/theme", () => {
  it("keeps the theme in a cookie and sends the browser back", async () => {
    const res = await post("dark", "https://x.test/k/abc?v=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/k/abc?v=2");
    expect(res.headers.get("set-cookie")).toBe("preview_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly");
  });
  it("refuses an unknown theme", async () => {
    expect((await post("neon")).status).toBe(400);
  });
  it("sends a referer that isn't a path of this app back to the start", async () => {
    const res = await post("auto", "https://x.test//evil.test/x");
    expect(res.headers.get("location")).toBe("/");
  });
});
