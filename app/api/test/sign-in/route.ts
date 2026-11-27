import { ENV_PREFIX } from "@/backend";
import { testSignInRoute } from "next-app-kit/testing";
import { runtime } from "@/app/_lib/runtime";

// The end-to-end tests' way in: GET ?email=…&next=/path. Exists only with PREVIEW_E2E=1 outside a production build; there, GET is
// undefined and this route has no handler (next-app-kit/testing).
export const GET = testSignInRoute(ENV_PREFIX, () => runtime().auth());
