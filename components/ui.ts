// The few class lists every page shares: one look for a button, a field and a notice, so the screens stay alike.
export const ui = {
  button:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 py-2 font-medium text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-danger px-4 py-2 font-medium text-danger hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50",
  icon: "inline-flex size-11 items-center justify-center rounded-md border border-line bg-paper text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40",
  label: "block text-sm font-medium",
  hint: "mt-1 block text-sm text-muted",
  input: "mt-1 block w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink",
  problem: "flex items-start gap-2 rounded-md border border-danger p-3 text-danger",
  status: "flex items-center gap-2 text-sm text-muted",
  h1: "font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] md:text-[2.75rem]",
  h2: "font-display text-[1.0625rem] font-bold tracking-tight",
  /** A group of a page: a card on the surface colour. */
  card: "rounded-md border border-border bg-paper p-4",
  iconSize: "size-4 shrink-0",
} as const;
