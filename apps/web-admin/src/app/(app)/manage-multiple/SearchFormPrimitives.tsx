import type { ReactNode } from "react";

export function StepHeading({
  step,
  title,
  hint,
  icon,
}: {
  step: number;
  title: string;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary font-display mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {hint}
        </p>
      </div>
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
      : "border-border text-foreground";
  return (
    <label
      className={`bg-card shadow-elev flex flex-col gap-1 rounded-2xl border px-5 py-4 transition focus-within:border-primary ${toneClasses}`}
    >
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
        {label}
      </span>
      <div className="flex items-center justify-center py-1">{children}</div>
      <span className="text-muted-foreground text-center text-[11px]">
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
        "bg-card shadow-elev flex flex-col gap-3 rounded-2xl border px-5 py-4 transition " +
        (active ? "border-primary/50" : "border-border")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
          {label}
        </span>
        <span className="text-muted-foreground/70 text-[11px]">{footer}</span>
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
            className={
              "rounded-xl px-3 py-1.5 text-sm font-medium tabular-nums transition " +
              (selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
