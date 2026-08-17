"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Modular boxes ─────────────────────────────────────────────────────────

// COLOUR LIVES ON THE PASSPORT, NOWHERE ELSE ON THIS PAGE (decision: Pato,
// MESITA-1132). Every box used to carry its own tinted icon chip — pink
// Instagram, amber Class, blue Plan, violet AI, sky Profile — on the theory
// that colour made the surface read premium. Seven accents in a vertical stack
// did the opposite: they gave equal emphasis to seven things, so nothing led,
// and they competed with the one place colour carries meaning. The passport
// says the class in a metal; the list underneath is a list.
//
// There is no `tint` prop any more, deliberately. A neutral chip cannot drift
// back one box at a time.

function BoxShell({
  icon,
  title,
  summary,
  trailing,
  onClick,
  disabled,
  soon = false,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  trailing?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  // Parked (soon) rows are BLOCKED, not removed: kept visible so the surface
  // reads as intentional, but non-interactive with a Soon pill. Un-park =
  // drop `soon` and the row is live again.
  const inert = disabled || soon;
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={inert}
      aria-disabled={inert}
      title={soon ? "Coming soon" : undefined}
      className={cn(
        "border-border bg-card flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
        inert ? "opacity-60" : "hover:bg-muted/50",
      )}
    >
      <span
        className="bg-muted text-foreground/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold tracking-tight">{title}</span>
          {soon && (
            <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] uppercase">
              Soon
            </span>
          )}
        </span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {summary}
        </span>
      </span>
      {trailing}
      {!soon && (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

export function BoxRow({
  Icon,
  title,
  summary,
  onClick,
  disabled,
  soon,
}: {
  Icon: LucideIcon;
  title: string;
  summary: string;
  onClick: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  return (
    <BoxShell
      icon={<Icon className="h-[22px] w-[22px]" />}
      title={title}
      summary={summary}
      onClick={onClick}
      disabled={disabled}
      soon={soon}
    />
  );
}
