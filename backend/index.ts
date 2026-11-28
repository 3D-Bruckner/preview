// The backend as the frontend sees it: app/, components/, proxy.ts and instrumentation.ts import only from here (ESLint's boundary rule).
import { signInSettings, type MailWording } from "./accounts";
import { loadConfig } from "./config";
import { log as processLog } from "./log";
import { openRuntime, type Runtime } from "./runtime";

export { API_TOKEN_PREFIX, APP_NAME, CONSENT_PAGE, ENV_PREFIX, SIGN_IN_PAGE, type MailWording } from "./accounts";
export { logoFile } from "./brand";
export type { Brand, Config } from "./config";
export { createCustomer, customerByToken, getCustomer, listCustomers, renewLink, revokeLink, updateCustomer, type Customer, type Language } from "./customers";
export {
  customerFile,
  customerLanguage,
  customerModel,
  customerView,
  type CustomerModelView,
  type CustomerVersionView,
  type CustomerView,
} from "./customerview";
export { fillMissingFacts } from "./facts";
export { resliceVersion } from "./figures";
export { listFeedback, markFeedbackSeen, sendFeedback, unseenFeedback, type Feedback } from "./feedback";
export { createFilament, deleteFilament, filamentName, listFilaments, updateFilament, type Filament } from "./filaments";
export { startSliceWorker } from "./slicer";
export { addVersion, UPLOAD_TYPES, versionFile, type UploadedFile } from "./files";
export { healthResponse } from "./health";
export { log } from "./log";
export { MCP_INSTRUCTIONS, mcpContext } from "./mcp";
export { createModel, getModel, listModels, updateModel, type Model } from "./models";
export type { Outcome, Reason } from "./outcome";
export { OPEN_API, REST_OPS } from "./rest";
export type { Runtime } from "./runtime";
export { listVersions, type Version } from "./versions";
export { modelSeenAt, recordView } from "./views";

// One runtime per process, kept on globalThis so Next's dev server, which reloads modules, doesn't open the database twice.
const g = globalThis as { __preview?: Runtime };

/**
 * The process's runtime, opened from the environment at the first call; a bad setting throws, naming it. `mail` is the sign-in mail's
 * words and language pick, which the frontend owns (app/_lib/runtime.ts); it is read at the first call only.
 */
export function runtime(mail: MailWording): Runtime {
  if (!g.__preview) {
    const config = loadConfig(process.env);
    g.__preview = openRuntime(config, signInSettings(process.env, config.dataDir, processLog), mail);
  }
  return g.__preview;
}
