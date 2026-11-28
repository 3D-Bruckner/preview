// Runs once when the server starts: reads the settings and opens preview.sqlite (bringing it to the last migration), so a bad setting or a
// broken database stops the start instead of the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { fillMissingFacts, log, startSliceWorker } = await import("@/backend");
  const { runtime } = await import("@/app/_lib/runtime");
  const rt = runtime();
  log.info({ publicUrl: rt.config.publicUrl, allowed: rt.config.allowedEmails.length, devUser: Boolean(rt.config.devUser) }, "preview started");
  // The versions stored before their facts existed (or read by an older reader) get them now; a large 3MF takes seconds, after the start.
  setTimeout(() => {
    const counts = fillMissingFacts(rt);
    if (counts.read || counts.failed) log.info(counts, "facts read for stored versions");
    // The versions whose 3MF has no print figures of its own are the slicer's (backend/slicer.ts): a pass now, after the facts, then
    // every minute (every second in the end-to-end tests, whose versions are seeded by another process) and at each upload.
    if (rt.config.slicer) startSliceWorker(rt, { pollMs: process.env.PREVIEW_E2E ? 1000 : 60_000 });
  }, 0);
}
