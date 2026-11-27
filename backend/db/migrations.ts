// preview.sqlite's schema, in order, run by the kit's migrate at open (next-app-kit/migrations). A migration that has shipped is never
// edited: a change to the schema is a new migration at the end of the list.
import type { Migration } from "next-app-kit/migrations";

export const MIGRATIONS: Migration[] = [];
