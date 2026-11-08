"use client";

import type React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/format";
import { PLACE_META_CLASS, PLACE_TITLE_CLASS } from "../../lib/ui";

// ── Box primitive ───────────────────────────────────────────────────────

export function Box({
  title,
  right,
  children,
  className,
  bare = false,
}: {
  title?: string;
  /** Unused since MESITA-2636 (titles carry no icon); kept so callers compile. */
  icon?: LucideIcon;
  iconColor?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        // 12px corners since MESITA-3325 (Pato: "the borders are just
        // extremely rounded. Maybe can be a bit less"); 16px from MESITA-2636.
        "border-border bg-card flex flex-col rounded-xl border",
        bare ? "overflow-hidden" : "gap-3 p-4",
        className,
      )}
    >
      {/* THE TITLE (MESITA-2636): sentence case, 16px semibold Inter ink, no
          icon and no uppercase tracking. It was a serif small-caps eyebrow
          behind a muted glyph; the `icon` props stay so callers need not
          change, and draw nothing. */}
      {(title || right) && (
        // CENTERED TITLES (Pato, MESITA-3438: "try centralizing the titles
        // ... lets test it"): three columns, the title in the middle and any
        // note (Location's km) at the right; left-aligned until then.
        <header className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
          <span aria-hidden />
          {title ? <BoxLabel>{title}</BoxLabel> : <span />}
          {right ? (
            <span className={cn(PLACE_META_CLASS, "min-w-0 shrink text-right")}>
              {right}
            </span>
          ) : (
            <span aria-hidden />
          )}
        </header>
      )}
      {children}
    </section>
  );
}

function BoxLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={PLACE_TITLE_CLASS}>{children}</h3>
  );
}

export function BoxHScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}
