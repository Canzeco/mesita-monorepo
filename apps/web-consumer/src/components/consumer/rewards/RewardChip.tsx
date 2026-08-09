"use client";

// RewardChip — one selectable action row in the wizard's Pick reward step
// (design D3 "Big number"). ≥44px hit target, aria-pressed, % anchored right.
// A disabled chip stays visible (D11: the +% a guest can't have yet is the
// app's best Instagram-connect prompt) with an explanatory sub-label.

import { cn } from "@/lib/utils";

export function RewardChip({
  icon,
  label,
  subLabel,
  percent,
  selected,
  disabled = false,
  onSelect,
}: {
  icon?: React.ReactNode;
  label: string;
  /** Secondary line, e.g. "+ Connect Instagram" on a disabled Story chip. */
  subLabel?: string;
  /** Display rate (rateForSegment) — null hides the number (zero rung). */
  percent: number | null;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-full border-[1.5px] px-4 py-2.5 text-left transition",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card",
        disabled
          ? "border-dashed opacity-60"
          : "active:scale-[0.99]",
      )}
    >
      {icon ? (
        <span
          className={cn(
            "shrink-0",
            selected ? "text-primary" : "text-secondary",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13px] leading-tight font-bold">
          {label}
        </span>
        {subLabel ? (
          <span className="text-secondary block truncate text-[10.5px] font-bold">
            {subLabel}
          </span>
        ) : null}
      </span>
      {percent != null && percent > 0 ? (
        <span
          className={cn(
            "font-display shrink-0 text-[17px] leading-none font-extrabold tabular-nums",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {percent}%
        </span>
      ) : null}
    </button>
  );
}
