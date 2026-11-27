// Whether the page runs in the browser yet: false in the server's HTML and during hydration, true after. A button whose click needs the
// client (a server action started from an onClick) is disabled until then, so a tap before hydration isn't swallowed silently, and an
// end-to-end test's click waits for it (Playwright waits for an enabled button).
import { useSyncExternalStore } from "react";

const never = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}
