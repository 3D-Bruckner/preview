import type { Page } from "@playwright/test";

/** The one address the e2e server's PREVIEW_ALLOWED_EMAILS lets in: whoever runs the instance. */
export const OWNER = "owner@example.com";

/** Signs the browser in through the kit's test-only route (PREVIEW_E2E=1) and opens `next`. */
export async function signIn(page: Page, next = "/"): Promise<void> {
  await page.goto(`/api/test/sign-in?${new URLSearchParams({ email: OWNER, next })}`);
}
