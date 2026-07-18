import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared presentational primitives for the discovery filter sheet (MESITA-672):
// Pill + SectionLabel + a generic brand-filled RangeSlider driving the When
// (hour), Distance (km) and Randomness (0–5) modules. One copy, both the sheet
// body and the Where search field read from here.

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

// Soft borderless pill — muted at rest, brand gradient when selected.
// min-h-11 keeps every filter control at the 44px touch floor.
export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-sm"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
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
