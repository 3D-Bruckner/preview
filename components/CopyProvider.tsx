"use client";
import { createContext, useContext, type ReactNode } from "react";
import { copyFor, DEFAULT_LOCALE, type Copy, type Locale } from "@/components/copy";

// The page's language for client components. Only the locale crosses from the server; each client component takes its words from the
// copy module itself.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function CopyProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);
export const useCopy = (): Copy => copyFor(useContext(LocaleContext));
