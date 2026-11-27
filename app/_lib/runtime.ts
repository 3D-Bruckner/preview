import { runtime as openRuntime, type MailWording, type Runtime } from "@/backend";
import { COPIES, languageOf } from "@/components/copy";

// The process's runtime as the frontend asks for it: the backend's, handed the sign-in mail's words from the copy modules and the same
// language pick proxy.ts makes (backend/ never imports the frontend). Every route handler, page and instrumentation.ts take it from here.
const MAIL: MailWording = { texts: { en: COPIES.en.mail, de: COPIES.de.mail }, languageOf };

export const runtime = (): Runtime => openRuntime(MAIL);
