import { cn } from "./cn";
import { Card } from "./ui/card";

// The one card (MESITA-3948): white, hairline, rounded-2xl, p-4 sm:p-6, no
// shadow. Server-safe. The header is an optional muted icon, the title, a
// wrapping subtitle and a right slot that stacks under the title below sm.
export function SectionCard({
  id,
  icon,
  title,
  subtitle,
  right,
  tone = "default",
  className,
  children,
}: {
  /** Scroll/focus target. */
  id?: string;
  /** A lucide glyph; the card paints it muted (destructive on a danger card). */
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** Card-level actions or state. */
  right?: React.ReactNode;
  /** `danger` = the DB reset card. */
  tone?: "default" | "danger";
  /** Layout only (margin, width, grid placement). */
  className?: string;
  children?: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <Card id={id} className={cn(danger && "border-destructive/40 bg-destructive/5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-2", danger && "text-destructive")}>
            {icon != null ? (
              <span
                aria-hidden
                className={cn(
                  "inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4",
                  danger ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {icon}
              </span>
            ) : null}
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          </div>
          {subtitle ? (
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        {right != null ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      {children}
    </Card>
  );
}

/** The one stat block: a type-label caption over a display numeral. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-muted-foreground type-label font-semibold">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-muted-foreground type-meta">{hint}</span> : null}
    </div>
  );
}
