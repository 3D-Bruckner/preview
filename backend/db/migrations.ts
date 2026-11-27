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
];
