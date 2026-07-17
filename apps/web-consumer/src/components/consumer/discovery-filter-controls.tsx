import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "8:00 PM"-style label for a 0–23 hour. */
export function formatHourLabel(hour: number): string {
  const clamped = Math.min(23, Math.max(0, Math.round(hour)));
  const suffix = clamped < 12 ? "AM" : "PM";
  const base = clamped % 12 === 0 ? 12 : clamped % 12;
  return `${base}:00 ${suffix}`;
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide",
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

// Slim styled native range for the hour — brand fill up to the thumb.
// Dimmed while "Now" is active, but stays live: dragging it IS how the
// user leaves Now. Only rendered inside the sheet (client-only mount), so
// the new Date() resting position can't desync hydration.
export function HourRange({
  value,
  dimmed,
  onChange,
}: {
  value: number;
  dimmed: boolean;
  onChange: (hour: number) => void;
}) {
  const pct = (value / 23) * 100;
  return (
    <input
      type="range"
      min={0}
      max={23}
      step={1}
      value={value}
      aria-label="Hour of day"
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full transition-opacity outline-none",
        "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
        dimmed && "opacity-50",
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
