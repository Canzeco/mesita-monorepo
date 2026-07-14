"use client";

import type { LaneId } from "@/lib/business/scores";

// Tiny presentational bits shared by the Params and Playground panels.

export const LANE_SHORT: Record<LaneId, string> = {
  "organic-now": "ON",
  "organic-future": "OF",
  "inorganic-now": "IN",
  "inorganic-future": "IF",
};

export function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

export function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/80 text-[12px] font-semibold tracking-tight">{children}</p>;
}

export function Chip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-foreground/80 text-[13px] font-medium">{label}</p>
      <p className="mt-1 font-mono text-[13px] font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 font-mono text-[10px] leading-snug">{hint}</p>
    </div>
  );
}

export function Slider({
  label,
  value,
  hint,
  min,
  max,
  step,
  v,
  onChange,
}: {
  label: string;
  value: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground/80 text-[13px] font-medium">{label}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-primary mt-2 w-full"
      />
      <p className="text-muted-foreground mt-1 font-mono text-[10px] leading-snug">{hint}</p>
    </div>
  );
}

/** The shared card shell every scoring tab wraps its panel in. */
export function PanelCard({
  title,
  subtitle,
  pill,
  children,
}: {
  title: string;
  subtitle: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">{subtitle}</p>
        </div>
        {pill ? (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold">
            {pill}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The data-access contract of one sub-function — three columns of fields. */
export function ContextCols({
  ctx,
}: {
  ctx: {
    consumer: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
    intent: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
    place: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
  };
}) {
  const col = (
    label: string,
    fields: { field: string; status: "live" | "planned" | "spec"; note?: string }[],
  ) => (
    <div>
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span
            key={f.field}
            title={f.note}
            className={
              "rounded-md border px-2 py-0.5 font-mono text-[10.5px] " +
              (f.status === "live"
                ? "border-border/70 bg-muted/50 text-foreground/80"
                : f.status === "spec"
                  ? "border-border/70 text-foreground/60 border-dashed"
                  : "border-border/50 text-muted-foreground border-dashed opacity-75")
            }
          >
            {f.field}
            {f.status !== "live" ? (
              <span className="text-muted-foreground/80"> · {f.status}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {col("Consumer-data", ctx.consumer)}
      {col("Intent-data", ctx.intent)}
      {col("Place-data", ctx.place)}
    </div>
  );
}
