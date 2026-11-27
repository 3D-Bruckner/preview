// Runs once when the server starts: reads the settings and opens preview.sqlite (bringing it to the last migration), so a bad setting or a
// broken database stops the start instead of the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { fillMissingFacts, log } = await import("@/backend");
  const { runtime } = await import("@/app/_lib/runtime");
  const rt = runtime();
  log.info({ publicUrl: rt.config.publicUrl, allowed: rt.config.allowedEmails.length, devUser: Boolean(rt.config.devUser) }, "preview started");
  // The versions stored before their facts existed (or read by an older reader) get them now; a large 3MF takes seconds, after the start.
  setImmediate(() => {
    const counts = fillMissingFacts(rt);
    if (counts.read || counts.failed) log.info(counts, "facts read for stored versions");
  });
}
