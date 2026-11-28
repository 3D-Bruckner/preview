"use client";
import { createContext, useContext } from "react";
import type { CustomerFilament } from "@/backend/client";

/** The colours a customer picked on a model page (ModelReview holds them): a filament per part, for the view and the feedback. */
export type Wishes = {
  /** The operator's filaments on offer; none: no pickers. */
  filaments: readonly CustomerFilament[];
  /** The picked filament's id per part key. */
  picked: ReadonlyMap<string, string>;
  /** Each part's name as the parts list shows it. */
  labels: ReadonlyMap<string, string>;
  pick(part: string, filamentId: string | null): void;
};

const WishesContext = createContext<Wishes>({ filaments: [], picked: new Map(), labels: new Map(), pick: () => {} });

export const WishesProvider = WishesContext.Provider;

export function useWishes(): Wishes {
  return useContext(WishesContext);
}
