import { runtime } from "@/app/_lib/runtime";
import { uploadVersion } from "./upload";

// POST: a model's next version, as multipart form data (upload.ts).
export async function POST(req: Request, ctx: RouteContext<"/api/models/[id]/versions">) {
  return uploadVersion(runtime(), req, (await ctx.params).id);
}
