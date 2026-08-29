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
        "text-primary/70 type-meta mb-3 font-bold tracking-[0.16em] uppercase",
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
        "type-label mb-2 font-semibold tracking-wide",
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
  dense = false,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** Compact box — the Search map Filters sheet must fit without scrolling. */
  dense?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border",
        dense ? "p-3" : "p-4",
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
  size = "md",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** "sm" packs dense sheets (Search map Filters) — every option visible, no scroll. */
  size?: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition",
        size === "sm" ? "type-meta min-h-8 px-3" : "type-body min-h-11 px-4",
        disabled
          ? "bg-muted/40 text-muted-foreground/60 cursor-not-allowed"
          : active
            ? "bg-pink-gradient shadow-glow-sm text-white active:scale-[0.97]"
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
    <span className="bg-foreground/10 text-muted-foreground/70 type-meta rounded-full px-1.5 py-0.5 font-bold tracking-[0.08em] uppercase">
      soon
    </span>
  );
}

// Slim brand-filled native range (hour / km). The fill runs to the
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
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[var(--shadow-rest)]",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[var(--shadow-rest)]",
        dimmed && "opacity-50",
        className,
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
