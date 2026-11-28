import type { ReactNode } from "react";
import type { Locale } from "@/components/copy";

// The language switch's flags, one per language of components/copy. A flag is a picture of the language, never its only name: the
// button carries the language's name in its own language (aria-label, lang). A language without a flag here shows its code instead.
const FLAGS: Partial<Record<Locale, ReactNode>> = {
  de: (
    <>
      <rect width="30" height="7" y="0" fill="#000" />
      <rect width="30" height="7" y="7" fill="#dd0000" />
      <rect width="30" height="6" y="14" fill="#ffce00" />
    </>
  ),
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
};

export function Flag({ locale }: { locale: Locale }) {
  const flag = FLAGS[locale];
  if (!flag) return <span className="text-xs font-semibold uppercase">{locale}</span>;
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className="h-3.5 w-[21px] rounded-[2px] shadow-[0_0_0_1px_rgb(127_127_127/0.35)]">
      {flag}
    </svg>
  );
}
