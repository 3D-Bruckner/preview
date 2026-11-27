// Runs preview as the owner of DATA_DIR (default /data), so the database and the uploaded files on a bind mount belong to the host user. PUID/PGID
// override that. A root-owned DATA_DIR (Docker created the bind-mount folder) falls back to uid/gid 1000. Only DATA_DIR itself is chowned,
// never the files in it. A Node script, because the distroless image has no shell: the server is loaded into this process once it has given up root.
import { chownSync, statSync } from "node:fs";

// Started with `user:`: nothing to switch.
if (process.getuid?.() === 0) {
  const dataDir = process.env.DATA_DIR ?? "/data";
  const data = statSync(dataDir);
  const uid = Number(process.env.PUID || data.uid) || 1000;
  const gid = Number(process.env.PGID || data.gid) || 1000;
  if (data.uid !== uid || data.gid !== gid) chownSync(dataDir, uid, gid);
  process.setgroups([gid]);
  process.setgid(gid);
  process.setuid(uid);
}

await import("./server.js");
