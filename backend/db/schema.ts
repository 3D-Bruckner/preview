// The tables of preview.sqlite as kysely sees them, one entry per table that backend/db/migrations.ts creates. Rows come out of the store
// as Selectable<…> (snake_case, as stored); the domain turns them into its own types. No table yet.
export type DB = Record<string, never>;
