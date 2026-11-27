// What a customer sees behind their link: their models, each model's versions and the versions' files. Every read here starts from
// customerByToken, the one gate (conventions: architecture/one-gate-for-every-read), and reaches a model, a version or a file only through
// that customer: an id from the URL that is not theirs is answered like an unknown token, with null (the page's 404).
import { customerByToken, type Customer, type Language } from "./customers";
import { factsOf } from "./facts";
import { versionFile } from "./files";
import { emptyFacts, type Facts } from "./threemf";
import type { Runtime } from "./runtime";

export type CustomerView = {
  customer: { name: string };
  /** The customer's models that have a version, newest first; a model with none has nothing to show yet. */
  models: {
    id: string;
    title: string;
    description: string | null;
    /** `parts`: how many its 3MF has; null until its facts are read. */
    latest: { number: number; createdAt: string; note: string | null; previewUrl: string; parts: number | null };
  }[];
};

export type CustomerVersionView = {
  number: number;
  note: string | null;
  createdAt: string;
  threemfUrl: string;
  previewUrl: string;
  /** Its parts and filament slots; empty (shown as a whole, no parts list) until read. */
  facts: Facts;
  drawings: { url: string; kind: "png" | "svg" | "pdf" }[];
};

export type CustomerModelView = { model: { id: string; title: string; description: string | null }; versions: CustomerVersionView[] };

/** Where a version's files are served: app/k/[token]/files/[version]/[file], outside the proxy. */
const filesUrl = (token: string, versionId: string) => `/k/${token}/files/${versionId}`;

/** The model, when it is the customer's. */
function modelOf(rt: Runtime, customer: Customer, modelId: string) {
  const model = rt.store.model(modelId);
  return model && model.customer_id === customer.id ? model : null;
}

function versionsOf(rt: Runtime, token: string, modelId: string): CustomerVersionView[] {
  const rows = rt.store.versionsOfModel(modelId);
  const drawings = rt.store.drawingsOfVersions(rows.map((v) => v.id));
  return rows.map((v) => {
    const base = filesUrl(token, v.id);
    return {
      number: v.number,
      note: v.note,
      createdAt: v.created_at,
      threemfUrl: `${base}/model.3mf`,
      previewUrl: `${base}/preview.png`,
      facts: factsOf(v) ?? emptyFacts(),
      drawings: drawings.filter((d) => d.version_id === v.id).map((d) => ({ url: `${base}/${d.id}.${d.kind}`, kind: d.kind })),
    };
  });
}

/** The customer's page: their name and models; null for a token that opens nothing. */
export function customerView(rt: Runtime, token: string): CustomerView | null {
  const customer = customerByToken(rt, token);
  if (!customer) return null;
  const models: CustomerView["models"] = [];
  for (const m of rt.store.models(customer.id)) {
    const latest = rt.store.versionsOfModel(m.id)[0];
    if (!latest) continue;
    models.push({
      id: m.id,
      title: m.title,
      description: m.description,
      latest: {
        number: latest.number,
        createdAt: latest.created_at,
        note: latest.note,
        previewUrl: `${filesUrl(token, latest.id)}/preview.png`,
        parts: factsOf(latest)?.parts.length ?? null,
      },
    });
  }
  return { customer: { name: customer.name }, models };
}

/** One model's page: the model and its versions, newest first; null unless the model is the token's customer's and has a version. */
export function customerModel(rt: Runtime, token: string, modelId: string): CustomerModelView | null {
  const customer = customerByToken(rt, token);
  if (!customer) return null;
  const model = modelOf(rt, customer, modelId);
  if (!model) return null;
  const versions = versionsOf(rt, token, model.id);
  if (versions.length === 0) return null;
  return { model: { id: model.id, title: model.title, description: model.description }, versions };
}

/**
 * A file of the token's customer's version, by the name its address ends in (model.3mf, preview.png, <drawing id>.<kind>): where it is
 * stored and its type; null when the token, the version or the file is not the customer's.
 */
export function customerFile(rt: Runtime, token: string, versionId: string, file: string): { path: string; type: string } | null {
  const customer = customerByToken(rt, token);
  if (!customer) return null;
  const version = rt.store.version(versionId);
  if (!version || !modelOf(rt, customer, version.model_id)) return null;
  let kind: Parameters<typeof versionFile>[2];
  if (file === "model.3mf") kind = "3mf";
  else if (file === "preview.png") kind = "preview";
  else {
    const m = /^([0-9a-f-]{36})\.(png|svg|pdf)$/.exec(file);
    const drawing = m && rt.store.drawing(version.id, m[1]!);
    if (!drawing || drawing.kind !== m[2]) return null;
    kind = { drawing: drawing.id };
  }
  const found = versionFile(rt, version.id, kind);
  return found.ok ? found.value : null;
}

/** The language the token's customer's pages open in (proxy.ts, when the visitor picked none); null for a token that opens nothing. */
export function customerLanguage(rt: Runtime, token: string): Language | null {
  return customerByToken(rt, token)?.language ?? null;
}
