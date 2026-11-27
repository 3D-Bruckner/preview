"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCopy } from "@/components/CopyProvider";
import { CustomersIcon, SettingsIcon } from "@/components/icons";

// The menu, a tab bar at the bottom of the screen where the thumb is (its height is --tabbar in globals.css). The current part is marked by
// aria-current, by its weight and a bar above it, not by colour alone.
const PARTS = [
  { href: "/", key: "customers", Icon: CustomersIcon, matches: (p: string) => p === "/" || p.startsWith("/customers") || p.startsWith("/models") },
  { href: "/settings", key: "settings", Icon: SettingsIcon, matches: (p: string) => p.startsWith("/settings") },
] as const;

export function NavLinks() {
  const t = useCopy().nav;
  // The browser's path; should a rewritten one with its language come through, the language is dropped.
  const path = usePathname().replace(/^\/(?:en|de)(?=\/|$)/, "") || "/";
  return (
    <nav
      data-tabbar
      aria-label={t.label}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-paper/85"
    >
      <ul className="mx-auto grid h-[3.75rem] max-w-3xl grid-cols-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {PARTS.map(({ href, key, Icon, matches }) => {
          const current = matches(path);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] whitespace-nowrap sm:text-xs ${current ? "font-bold text-accent before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full before:bg-accent" : "font-medium text-muted hover:text-ink"}`}
              >
                <Icon aria-hidden="true" className="size-[1.375rem]" strokeWidth={current ? 2.25 : 1.75} />
                {t[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
