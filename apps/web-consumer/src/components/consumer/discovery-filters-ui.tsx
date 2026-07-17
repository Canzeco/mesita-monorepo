"use client";

import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Per-section accent — tinted icon circle + value pill (premium bar:
// differentiated colors, never four identical gray rows).
export const DISCOVERY_FILTER_TINTS = {
  where: { circle: "bg-primary/10 text-primary", pill: "bg-primary/10 text-primary" },
  when: { circle: "bg-amber-500/15 text-amber-600", pill: "bg-amber-500/15 text-amber-700" },
  what: { circle: "bg-violet-500/15 text-violet-600", pill: "bg-violet-500/15 text-violet-700" },
  random: { circle: "bg-emerald-500/15 text-emerald-600", pill: "bg-emerald-500/15 text-emerald-700" },
} as const;

// One filter = one card: tinted icon circle + title + live value pill.
export function Section({
  icon: Icon,
  label,
  value,
  tint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  tint: { circle: string; pill: string };
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            tint.circle,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold">{label}</span>
        {value && (
          <span
            className={cn(
              "ml-auto max-w-[55%] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold",
              tint.pill,
            )}
          >
            {value}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// Where mode card (Near me / Anywhere) — icon circle, label, check badge.
export function ModeCard({
  icon: Icon,
  title,
  sub,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition active:scale-[0.98]",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          active
            ? "bg-pink-gradient text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-tight font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground block truncate text-[10px] leading-tight">
          {sub}
        </span>
      </span>
      {active && (
        <span
          className="bg-primary absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full text-white shadow-sm"
          aria-hidden="true"
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}
    </button>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected.
export function Pill({
  active,
  onClick,
  trailing,
  children,
}: {
  active: boolean;
  onClick: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-sm"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      {trailing}
    </button>
  );
}

// Styled native range input: brand-gradient fill up to the thumb, muted
// track after it, white-ringed thumb. Inline background because the fill
// percentage is dynamic.
export function GradientRange({
  min,
  max,
  value,
  onChange,
  ariaLabel,
  dimmed = false,
  className,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  dimmed?: boolean;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full transition-opacity outline-none",
        "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
        dimmed && "opacity-50",
        className,
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
