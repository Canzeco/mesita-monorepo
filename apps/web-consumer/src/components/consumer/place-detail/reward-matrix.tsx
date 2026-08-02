import type { LucideIcon } from "lucide-react";
import { Crown } from "lucide-react";

import type { ConsumerClass } from "@/lib/mock/place";
import { cn } from "@/lib/utils";

// One numbered step in the "How it works" sequence. The badge carries the
// step number; the tinted icon circle reads premium-violet for the
// Instagram-only step and brand-pink otherwise.
export function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          accent
            ? "bg-tier-premium/10 text-premium"
            : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="bg-foreground text-background absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
          {n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] leading-tight font-semibold">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          {body}
        </p>
      </div>
    </li>
  );
}

// Compact reward matrix — First / Returning rows × Standard / Premium columns.
// Mirrors the Class comparison table on the Profile (ClassComparison) for
// visual consistency. The active cell (current class × current visit axis)
// is highlighted so "you are here" is obvious. Every elevated class maps to the
// Premium column (the v4 columns only know the free-vs-elevated split).
export function RewardMatrix({
  welcome,
  returning,
  currentClass,
  isFirstVisit,
  suffix,
}: {
  welcome: { free: number | null; premium: number | null };
  returning: { free: number | null; premium: number | null };
  currentClass: ConsumerClass;
  isFirstVisit: boolean;
  /** Reward unit shown after the percent, e.g. "off". */
  suffix: string;
}) {
  const rows = [
    { key: "first", label: "First visit", vals: welcome, onAxis: isFirstVisit },
    {
      key: "returning",
      label: "Returning",
      vals: returning,
      onAxis: !isFirstVisit,
    },
  ] as const;
  return (
    <div className="border-border relative overflow-hidden rounded-xl border">
      {/* Continuous tint behind the whole Premium column (right third) so it
          reads as one column, not patched per cell. */}
      <span
        aria-hidden
        className="bg-tier-premium/[0.05] pointer-events-none absolute inset-y-0 right-0 w-1/3"
      />
      <div className="relative">
        {/* Header — Standard / Premium columns. */}
        <div className="grid grid-cols-3 items-center px-3 py-2.5">
          <span />
          <span className="font-display text-center text-[13px] font-bold tracking-tight">
            Standard
          </span>
          <span className="text-premium font-display flex items-center justify-center gap-1 text-[13px] font-bold tracking-tight">
            <Crown className="h-3 w-3 fill-current" />
            Premium
          </span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "grid grid-cols-3 items-center px-3 py-3",
              i > 0 && "border-border/40 border-t",
            )}
          >
            <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
              {r.label}
            </span>
            <RewardCell
              value={r.vals.free}
              suffix={suffix}
              active={r.onAxis && currentClass === "standard"}
            />
            <RewardCell
              value={r.vals.premium}
              suffix={suffix}
              accent
              // Every elevated class reads the elevated column.
              active={r.onAxis && currentClass !== "standard"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardCell({
  value,
  suffix,
  accent,
  active,
}: {
  value: number | null;
  suffix: string;
  accent?: boolean;
  active?: boolean;
}) {
  const text = value == null ? "—" : `${value}%`;
  const num = (
    <span
      className={cn(
        "font-display text-[15px] leading-none font-bold",
        active ? "text-white" : accent ? "text-premium" : "text-foreground/80",
      )}
    >
      {text}
    </span>
  );
  const unit =
    value != null ? (
      <span
        className={cn(
          "text-[10px]",
          active
            ? "text-white/85"
            : accent
              ? "text-premium/80"
              : "text-muted-foreground",
        )}
      >
        {suffix}
      </span>
    ) : null;

  if (active) {
    return (
      <span className="flex items-center justify-center">
        <span className="bg-pink-gradient shadow-glow relative inline-flex items-baseline gap-0.5 rounded-lg py-1.5 pr-5 pl-3">
          {num}
          {unit}
          <span className="absolute top-0.5 right-1.5 text-[7px] font-bold tracking-[0.1em] text-white/85 uppercase">
            Now
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline justify-center gap-0.5">
      {num}
      {unit}
    </span>
  );
}
