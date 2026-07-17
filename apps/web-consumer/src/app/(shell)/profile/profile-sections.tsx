"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Modular boxes ─────────────────────────────────────────────────────────

type BoxTint =
  | "pink"
  | "sky"
  | "emerald"
  | "violet"
  | "amber"
  | "muted"
  | "premium";

// Each option-box icon gets its own tinted circle so the Me page reads as a
// premium, colorful surface (never a flat gray stack).
const BOX_TINT: Record<BoxTint, string> = {
  pink: "bg-pink-gradient text-white",
  sky: "bg-sky-500/15 text-sky-600",
  emerald: "bg-emerald-500/15 text-emerald-600",
  violet: "bg-violet-500/15 text-violet-600",
  amber: "bg-amber-400/20 text-amber-700",
  muted: "bg-muted text-foreground/70",
  premium: "bg-tier-premium text-white",
};

function BoxShell({
  iconTint,
  icon,
  title,
  summary,
  trailing,
  onClick,
  disabled,
  soon = false,
}: {
  iconTint: BoxTint;
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
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm",
          BOX_TINT[iconTint],
        )}
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
  tint,
  title,
  summary,
  onClick,
  disabled,
  soon,
}: {
  Icon: LucideIcon;
  tint: BoxTint;
  title: string;
  summary: string;
  onClick: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  return (
    <BoxShell
      iconTint={tint}
      icon={<Icon className="h-[22px] w-[22px]" />}
      title={title}
      summary={summary}
      onClick={onClick}
      disabled={disabled}
      soon={soon}
    />
  );
}
