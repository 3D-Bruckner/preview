// The tables of preview.sqlite as kysely sees them, one entry per table that backend/db/migrations.ts creates. Rows come out of the store
// as Selectable<…> (snake_case, as stored); the domain turns them into its own types.

export interface CustomersTable {
  id: string;
  name: string;
  note: string | null;
  language: "de" | "en";
  /** The token in the customer's link; null once revoked. */
  link_token: string | null;
  created_at: string;
  /** When the customer last opened their link (not the operator); null: never. */
  seen_at: string | null;
}

export interface ModelsTable {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionsTable {
  id: string;
  model_id: string;
  number: number;
  note: string | null;
  threemf_file: string;
  preview_file: string;
  created_at: string;
  /** JSON of backend/threemf's Facts; null until read. */
  facts: string | null;
}

export interface DrawingsTable {
  id: string;
  version_id: string;
  file: string;
  kind: "png" | "svg" | "pdf";
  position: number;
}

export interface SliceJobsTable {
  version_id: string;
  state: "pending" | "done" | "failed";
  attempts: number;
  /** When a pending job is due (ISO time). */
  next_at: string;
  reason: string | null;
  /** JSON of backend/threemf's FactsFigures, once done. */
  figures: string | null;
  updated_at: string;
}

export interface FilamentsTable {
  id: string;
  name: string;
  material: string;
  /** #rrggbb, lower case. */
  color: string;
  /** 1: the customer can pick it; 0: kept, not offered. */
  available: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackTable {
  id: string;
  version_id: string;
  customer_id: string;
  comment: string | null;
  /** JSON of backend/feedback.ts's Wish[]. */
  wishes: string;
  created_at: string;
  seen_at: string | null;
}

export interface VersionViewsTable {
  version_id: string;
  /** When the customer last viewed this version. */
  seen_at: string;
}

export type DB = {
  customers: CustomersTable;
  models: ModelsTable;
  versions: VersionsTable;
  drawings: DrawingsTable;
  slice_jobs: SliceJobsTable;
  filaments: FilamentsTable;
  feedback: FeedbackTable;
  version_views: VersionViewsTable;
};

export type CustomerRow = CustomersTable;
export type ModelRow = ModelsTable;
export type VersionRow = VersionsTable;
export type DrawingRow = DrawingsTable;
export type SliceJobRow = SliceJobsTable;
export type FilamentRow = FilamentsTable;
export type FeedbackRow = FeedbackTable;
