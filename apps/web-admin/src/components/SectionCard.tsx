// The ELEVATED card shell — `shadow-card` on white, roomy p-5. It is the
// surface language of the working pages (manage-single, scoring-config); the
// config pages (enricher-config, sourcing-config, memo) run a deliberately
// FLAT namesake in `enricher-config/atlas-ui` — same name, different system.
// The two are not interchangeable: swapping one for the other re-skins a page.

/** Fixed tint palette for card icon chips — differentiated, never loud. */
export type Tint =
  | "rose"
  | "pink"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "teal"
  | "orange"
  | "indigo"
  | "slate";

export const TINT_CHIP: Record<Tint, string> = {
  rose: "bg-rose-500/10 text-rose-600",
  pink: "bg-pink-500/10 text-pink-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  teal: "bg-teal-500/10 text-teal-600",
  orange: "bg-orange-500/10 text-orange-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
  slate: "bg-muted text-muted-foreground",
};

export function SectionCard({
  icon,
  tint = "slate",
  title,
  subtitle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  /** Icon-chip hue — keep sibling cards on different tints. */
  tint?: Tint;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon != null && (
            <span
              className={
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                TINT_CHIP[tint]
              }
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
