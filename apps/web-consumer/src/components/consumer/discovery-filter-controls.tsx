import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared presentational primitives for the discovery Filters modal (MESITA-672):
// Pill + SectionLabel + a generic brand-filled RangeSlider driving the When
// (hour), Distance (km) and Random (0–4 word levels) modules.

/** Group tier ABOVE SectionLabel — INTENT (Where · When · What · That). */
export function FilterGroupLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-primary/70 mb-3 text-[10px] font-bold tracking-[0.16em] uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionLabel({
  children,
  className,
  sub = false,
}: {
  children: ReactNode;
  className?: string;
  /** Sub-row label inside a module (Distance, Categories, …). */
  sub?: boolean;
}) {
  return (
    <p
      className={cn(
        "mb-2 text-[11px] font-semibold tracking-wide",
        sub ? "text-muted-foreground/70" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Bordered module box for Where / When / What / That / Random. */
export function FilterModule({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border p-4",
        className,
      )}
    >
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected.
// min-h-11 keeps every filter control at the 44px touch floor.
// `disabled` is for options the model knows but the product can't back yet
// (Order, MESITA-1081) — shown rather than hidden, so the axis reads whole.
export function Pill({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition",
        disabled
          ? "bg-muted/40 text-muted-foreground/60 cursor-not-allowed"
          : active
            ? "bg-pink-gradient text-white shadow-sm active:scale-[0.97]"
            : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground active:scale-[0.97]",
      )}
    >
      {children}
    </button>
  );
}

/** `soon` tag riding inside a disabled Pill — the parked half of an axis. */
export function PillSoon() {
  return (
    <span className="bg-foreground/10 text-muted-foreground/70 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase">
      soon
    </span>
  );
}

// Slim brand-filled native range (hour / km / randomness). The fill runs to the
// thumb; `dimmed` softens it while the module rests on a neutral default but
// keeps it live — dragging is how the user leaves that default.
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
  dimmed = false,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  dimmed?: boolean;
  className?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full transition-opacity outline-none",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md",
        dimmed && "opacity-50",
        className,
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
