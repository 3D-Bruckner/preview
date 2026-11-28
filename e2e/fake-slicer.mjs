// A stand-in for the slicing service (3D-Bruckner/slicing) in the end-to-end tests: POST /estimate answers a fixed estimate at once,
// unless the uploaded 3MF holds a marker entry (a zip's entry names are stored uncompressed, so they can be found in the upload):
//   Metadata/e2e-busy-…         → 503 busy, every time (the version stays pending, "wird berechnet")
//   Metadata/e2e-refuse-once-<id> → 422 off_plate the first time this <id> is seen, the estimate after (Neu berechnen)
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SLICER_PORT ?? 3319);
const refused = new Set();

const estimate = {
  ok: true,
  grams: 12.5,
  minutes: 42,
  material: "PLA",
  multicolor: false,
  filaments: [{ slot: 1, type: "PLA", color: "", grams: 12.5 }],
  price: { exact: 1, customer: 2, low: 1, high: 3 },
  profile: "fake",
  pricing: "fake",
};

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/estimate") return send(res, 404, { ok: false, reason: "not_found" });
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("latin1");
    if (body.includes("Metadata/e2e-busy-")) return send(res, 503, { ok: false, reason: "busy" });
    const once = /Metadata\/e2e-refuse-once-([a-z0-9]+)/.exec(body);
    if (once && !refused.has(once[1])) {
      refused.add(once[1]);
      return send(res, 422, { ok: false, reason: "off_plate" });
    }
    send(res, 200, estimate);
  });
}).listen(PORT);
