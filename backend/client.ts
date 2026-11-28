// The part of the backend that runs in the browser: pure code, no Node, no database. Client components import it from here (ESLint lets
// the frontend import @/backend/client and nothing else under @/backend/), never from @/backend, whose runtime would drag the server in.
export { emptyFacts, UNIT_MM, type Facts, type FactsFigures, type FactsFilament, type FactsPart, type FactsSlot } from "./threemf/types";
export type { Figures } from "./figures";
