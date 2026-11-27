import { MultipartError, readMultipart, type Multipart } from "next-app-kit/multipart";
import { addVersion, getCustomer, getModel, UPLOAD_TYPES, type Runtime } from "@/backend";
import { copyFor, languageOf } from "@/components/copy";

// One version per request: the form's fields are `model` (one 3MF), `preview` (one PNG), `drawing` (0 to 10 PNG, SVG or PDF) and the text
// `note`. Authenticated by the session cookie (Better Auth's is SameSite=Lax, so a cross-site post acts for nobody) or by an API token that
// may write (Authorization: Bearer), which is how the workshop's script uploads. The files wait in the kit's temporary folder while
// addVersion checks and stores them, and that folder is removed afterwards, whatever happened. A refusal answers { error } in the language
// picked here as proxy.ts picks it for pages: the proxy never runs on this route, since Next would cut a proxied body at 10 MB.

const MAX_DRAWINGS = 10;

export async function uploadVersion(rt: Runtime, req: Request, modelId: string): Promise<Response> {
  const t = copyFor(languageOf(req.headers)).versions;
  const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
  if (!(await rt.person(req.headers))) {
    const caller = await rt.apiCaller(req);
    if (!caller) return refuse(401, t.signedOut);
    if (caller.scope !== "read+write") return refuse(403, t.readOnly);
  }
  const model = getModel(rt, modelId);
  if (!model.ok) return refuse(404, t.noModel);
  let upload: Multipart;
  try {
    upload = await readMultipart(req, { maxFileBytes: rt.config.maxUploadMb * 1024 * 1024, maxFiles: MAX_DRAWINGS + 2, types: UPLOAD_TYPES });
  } catch (e) {
    if (!(e instanceof MultipartError)) throw e;
    rt.log.info({ modelId, status: e.status, code: e.code }, "version upload refused");
    const text = { too_large: t.tooLarge, wrong_type: t.notAccepted, too_many: t.tooManyDrawings }[e.code as string] ?? t.incomplete;
    return refuse(e.status, text);
  }
  try {
    const named = (field: string) => upload.files.filter((f) => f.field === field);
    const [threemf, ...moreModels] = named("model");
    const [preview, ...morePreviews] = named("preview");
    const drawings = named("drawing");
    if (!threemf || moreModels.length) return refuse(400, t.noModelFile);
    if (!preview || morePreviews.length) return refuse(400, t.noPreview);
    if (drawings.length > MAX_DRAWINGS) return refuse(400, t.tooManyDrawings);
    if (named("model").length + named("preview").length + drawings.length !== upload.files.length) return refuse(400, t.notAccepted);
    const added = await addVersion(rt, modelId, { threemf, preview, drawings, note: upload.fields.note });
    if (!added.ok) return refuse(added.reason === "not_found" ? 404 : 400, added.reason === "not_found" ? t.noModel : t.unreadable);
    const customer = getCustomer(rt, model.value.customerId);
    const token = customer.ok ? customer.value.link : null;
    const link = token ? `${rt.config.publicUrl}/k/${token}/${modelId}` : null;
    const { id, number, note } = added.value;
    return Response.json({ id, number, note, link }, { status: 201, headers: { "cache-control": "no-store" } });
  } finally {
    await upload.cleanup();
  }
}
