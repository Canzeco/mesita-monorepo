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
        "border-border bg-card flex flex-col rounded-2xl border",
        bare ? "overflow-hidden" : "gap-3 p-4",
        className,
      )}
    >
      {/* THE TITLE (MESITA-2636): sentence case, 16px semibold Inter ink, no
          icon and no uppercase tracking. It was a serif small-caps eyebrow
          behind a muted glyph; the `icon` props stay so callers need not
          change, and draw nothing. */}
      {(title || right) && (
        <header className="flex items-baseline justify-between gap-3">
          {title && <BoxLabel>{title}</BoxLabel>}
          {right && (
            <span className={cn(PLACE_META_CLASS, "min-w-0 shrink text-right")}>
              {right}
            </span>
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
