// preview.sqlite's schema, in order, run by the kit's migrate at open (next-app-kit/migrations). A migration that has shipped is never
// edited: a change to the schema is a new migration at the end of the list.
import type { Migration } from "next-app-kit/migrations";

export const MIGRATIONS: Migration[] = [
  {
    // Customers (each with the link token they open their page by, null once revoked), their models, a model's numbered versions (the
    // files are names under DATA_DIR) and a version's drawings (position orders them).
    name: "models",
    sql: `
      create table customers (
        id text primary key,
        name text not null,
        note text,
        language text not null default 'de' check (language in ('de', 'en')),
        link_token text unique,
        created_at text not null
      );
      create table models (
        id text primary key,
        customer_id text not null references customers(id),
        title text not null,
        description text,
        created_at text not null,
        updated_at text not null
      );
      create index models_customer on models(customer_id);
      create table versions (
        id text primary key,
        model_id text not null references models(id) on delete cascade,
        number integer not null,
        note text,
        threemf_file text not null,
        preview_file text not null,
        created_at text not null,
        unique (model_id, number)
      );
      create table drawings (
        id text primary key,
        version_id text not null references versions(id) on delete cascade,
        file text not null,
        kind text not null check (kind in ('png', 'svg', 'pdf')),
        position integer not null
      );
      create index drawings_version on drawings(version_id);
    `,
  },
  {
    // A version's facts (backend/threemf: its parts and filament slots) as JSON, read once from its 3MF; null until read (the versions
    // stored before this migration get theirs at the next start, fillMissingFacts).
    name: "version_facts",
    sql: `alter table versions add column facts text;`,
  },
  {
    // The slicing service's work per version whose 3MF has no print figures of its own (backend/slicer.ts): pending until it answers
    // (next_at: when to ask, again after a busy answer), done with its figures (JSON of FactsFigures), or failed with the reason.
    // Apart from the facts, so reading a 3MF again never loses the slicer's answer.
    name: "slice_jobs",
    sql: `
      create table slice_jobs (
        version_id text primary key references versions(id) on delete cascade,
        state text not null check (state in ('pending', 'done', 'failed')),
        attempts integer not null default 0,
        next_at text not null,
        reason text,
        figures text,
        updated_at text not null
      );
      create index slice_jobs_due on slice_jobs(state, next_at);
    `,
  },
  {
    // The operator's filaments (backend/filaments.ts): what a customer can pick per part, in the order shown (position); available 0/1.
    name: "filaments",
    sql: `
      create table filaments (
        id text primary key,
        name text not null,
        material text not null,
        color text not null,
        available integer not null default 1,
        position integer not null,
        created_at text not null,
        updated_at text not null
      );
    `,
  },
  {
    // A customer's feedback on a version (backend/feedback.ts): a comment, colour wishes (JSON: part key and the filament copied in,
    // so deleting a filament keeps what was wished), when it came and when the operator saw it.
    name: "feedback",
    sql: `
      create table feedback (
        id text primary key,
        version_id text not null references versions(id) on delete cascade,
        customer_id text not null references customers(id) on delete cascade,
        comment text,
        wishes text not null,
        created_at text not null,
        seen_at text
      );
      create index feedback_customer on feedback(customer_id, created_at);
      create index feedback_version on feedback(version_id, created_at);
    `,
  },
];
