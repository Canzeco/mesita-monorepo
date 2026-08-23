import type { ReactNode } from "react";

// ELEVATION (MESITA design pass, 2026-08-22). Everything in this file used to
// wear `shadow-elev` — `0 25px 60px -15px`, the shadow ConfirmDialog uses to
// float a modal over an inert page. On a grid of small parameter inputs that
// reads as a field of hovering slabs, and it made this page the loudest
// surface in the console while being one of the quietest jobs.
//
// These are inputs. They sit INSIDE a card, so they take the same filled-well
// language as every other admin field (`bg-muted/60` + a hairline border) and
// carry no shadow at all. Depth is the card's job; these are its contents.

/** A labelled group inside a step card. The step's NUMBER lives on the card
 *  header chip, so this is deliberately a quiet sub-heading and not a second
 *  numbered circle — the page used to nest numbered steps inside numbered
 *  steps, which made one job look like four. */
export function StepHeading({
  title,
  hint,
  icon,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-muted-foreground flex items-center gap-1.5 type-eyebrow">
        {icon}
        {title}
      </h3>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

export function ParamCard({
  label,
  footer,
  tone = "default",
  children,
}: {
  label: string;
  footer: string;
  tone?: "default" | "warn";
  children: ReactNode;
}) {
  const toneClasses =
    tone === "warn"
      ? "border-destructive/40 text-destructive"
      : "border-border/60 text-foreground";
  return (
    <label
      className={`bg-muted/60 focus-within:border-ring/60 focus-within:bg-card focus-within:ring-ring/10 flex flex-col gap-1 rounded-xl border px-4 py-3 transition focus-within:ring-4 ${toneClasses}`}
    >
      <span className="text-muted-foreground type-meta font-medium tracking-[0.14em] uppercase">
        {label}
      </span>
      <div className="flex items-center justify-center py-1">{children}</div>
      <span className="text-muted-foreground text-center type-label">
        {footer}
      </span>
    </label>
  );
}

export function FilterCard({
  label,
  footer,
  active,
  children,
}: {
  label: string;
  footer: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "bg-muted/60 flex flex-col gap-3 rounded-xl border px-4 py-3 transition " +
        (active ? "border-ring/60" : "border-border/60")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground type-meta font-medium tracking-[0.14em] uppercase">
          {label}
        </span>
        <span className="text-muted-foreground/70 type-label">{footer}</span>
      </div>
      {children}
    </div>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            // h-10 to match the shipped field height: these chips sit beside
            // TextFields and SelectFields, and at py-1.5 they landed near 30px
            // — visibly shorter than everything around them and under any
            // reasonable pointer-target floor.
            className={
              "inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium tabular-nums transition " +
              (selected
                ? "bg-primary text-primary-foreground shadow-card"
                : "bg-card text-foreground/70 border-border/60 hover:bg-muted hover:text-foreground border")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
