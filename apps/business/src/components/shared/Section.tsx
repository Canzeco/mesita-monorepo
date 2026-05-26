// Shared section card — the canonical card primitive for every long-form
// business surface (Place, Promos, Team, Wallet, etc.). Replaces local
// `Section` definitions that were drifting between files.
//
// Layout: rounded card with a header row (title + optional description on
// the left, optional `right` element opposite) and the children stacked
// below. The outer `gap-3` on the flex column means children inherit
// vertical rhythm; pass `bodyClassName` to override.
//
// Pages compose multiple sections in a `<div className="flex flex-col
// gap-4">` so the inter-section spacing stays consistent.

import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  right,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-2xl border p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
              {description}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {contentClassName ? (
        <div className={contentClassName}>{children}</div>
      ) : (
        children
      )}
    </section>
  );
}
