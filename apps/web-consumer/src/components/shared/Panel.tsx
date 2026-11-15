import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// THE PANEL, ONE FOR THE WHOLE APP (Pato, 2026-11-15, MESITA-4071, picking
// Wallet's of the two box styles built that day): a section is one bordered
// white box with its 16px display heading INSIDE, 16px in from the edges.
// Rows inside run edge to edge (their own 16px padding lines their text up
// with the heading), split by hairlines: never a box in a box, no shadow.
// Wallet (MESITA-4063/4064) drew it first as WalletPanel; Me's SectionBox
// (MESITA-4052/4053), the heading above its box, is retired. Panels stack
// 16px apart; the caller spaces them (Wallet's `mt-4`, Me's `gap-4`).

// shrink-0 (MESITA-4078): in a flex-column scroller a panel must never be
// squeezed when something above it (the bill band) takes height; it was,
// and the Wallet's four buttons were cut by the panel's border.
export const PANEL_CLASS =
  "border-border bg-card shrink-0 overflow-hidden rounded-2xl border";

/** A section's heading, inside its panel: 16px display, never an eyebrow. */
export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-base font-semibold tracking-tight">
      {children}
    </h2>
  );
}

/** One section: the heading (with an optional control on its right) in its
 *  top-left, then whatever the section holds. No title: a plain panel. */
export function Panel({
  title,
  action,
  className,
  children,
  ...data
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
  [key: `data-${string}`]: string | boolean | undefined;
}) {
  return (
    <section
      className={cn(PANEL_CLASS, className)}
      aria-label={title}
      {...data}
    >
      {title || action ? (
        <div className="flex min-h-6 items-center justify-between gap-3 px-4 pt-4">
          {title ? <PanelHeading>{title}</PanelHeading> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
