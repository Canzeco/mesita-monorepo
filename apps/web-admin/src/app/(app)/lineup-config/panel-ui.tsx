"use client";

import { CONTEXT_FIELDS, type ContextSide } from "@/lib/business/scores";

// Tiny presentational bits shared by the Subscores and Scores & Lanes panels.

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

/** The ONE tile primitive for in-box mini-grids — worked examples, Lineup's
 * callers, the consumer-filters map. The box grammar allows exactly three
 * atoms: <Slider> (editable) · <Chip> (derived) · <MiniTile> (illustrative);
 * bespoke tile styles are banned. */
export function MiniTile({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-2.5 py-2" title={hint}>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.04em] uppercase">
        {label}
      </p>
      {value ? <p className="mt-0.5 font-mono text-[11px]">{value}</p> : null}
      {children}
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
  consumer = false,
}: {
  label: string;
  value: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (v: number) => void;
  /** GREEN class — a CONSUMER-OVERRIDABLE DEFAULT (the where tolerance,
   * XX's control): the admin sets the fallback here, the consumer's own
   * filter overrides it per query. Plain (pink) sliders are pure
   * hyperparameters the consumer never touches. */
  consumer?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground/80 flex items-center gap-1.5 text-[13px] font-medium">
          {consumer ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
              title="consumer-overridable default — their filter wins per query"
              aria-hidden
            />
          ) : null}
          {label}
        </span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label + (consumer ? " (consumer-overridable default)" : "")}
        className={(consumer ? "accent-emerald-600" : "accent-primary") + " mt-2 w-full"}
      />
      {hint ? (
        <p className="text-muted-foreground mt-1 font-mono text-[10px] leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

/** Per-subscore card washes — the optional full tint PanelCard can carry.
 * Kept for the neutral shell's tinted variant; the subscore boxes now use the
 * calmer CARD_ACCENTS spine instead (Pato 2026-07-26). Same hue per subscore
 * as the playground's ScoreBox colors. */
export const CARD_TINTS = {
  sky: "border-sky-500/25 bg-sky-500/[0.04]",
  emerald: "border-emerald-500/25 bg-emerald-500/[0.04]",
  amber: "border-amber-500/25 bg-amber-500/[0.04]",
  rose: "border-rose-500/25 bg-rose-500/[0.04]",
  violet: "border-violet-500/25 bg-violet-500/[0.04]",
  teal: "border-teal-500/25 bg-teal-500/[0.04]",
} as const;
export type CardTint = keyof typeof CARD_TINTS;

/** Per-subscore LEFT-EDGE accent — a thin colored spine on an otherwise
 * neutral card, the calm replacement for the old full-card wash (Pato
 * 2026-07-26 "cleaner"). Same hue per subscore as the emoji and the
 * playground ScoreBox, so identity survives without the rainbow. */
export const CARD_ACCENTS: Record<CardTint, string> = {
  sky: "border-l-sky-400",
  emerald: "border-l-emerald-400",
  amber: "border-l-amber-400",
  rose: "border-l-rose-400",
  violet: "border-l-violet-400",
  teal: "border-l-teal-400",
};

/** The shared card shell every scoring tab wraps its panel in. */
export function PanelCard({
  title,
  subtitle,
  pill,
  tint,
  children,
}: {
  title: string;
  subtitle?: string;
  pill?: string;
  tint?: CardTint;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "shadow-card rounded-2xl border p-5 sm:p-6 " +
        (tint ? CARD_TINTS[tint] : "border-border bg-card")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">{subtitle}</p>
          ) : null}
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

/** One of the FIVE parts every subscore box renders, in FIXED order (Pato
 * 2026-07-21): Overview · Hyperparams · Inputs · Process · Outputs.
 * Overview/Process/Outputs are explanations, not config; Hyperparams is the
 * knob grid (pink hyperparameters + green consumer defaults); Inputs is the
 * fixed listing of the data fields the subscore reads — documentation, never
 * config (Pato 2026-07-21). */
export function BoxSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/40 mt-4 border-t pt-3">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** The fixed input fields of one subscore — plain chip columns. A source
 * whose fields are ALL "—" placeholders is not rendered (GP/RP read only the
 * place, XX only its own draw — an em-dash column says nothing); interaction
 * = the consumer × place EDGE, SM-only. */
export function ContextCols({
  ctx,
}: {
  ctx: {
    consumer: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
    intent: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
    place: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
    interaction?: { field: string; status: "live" | "planned" | "spec"; note?: string }[];
  };
}) {
  const col = (
    label: string,
    fields: { field: string; status: "live" | "planned" | "spec"; note?: string }[],
  ) => (
    <div key={label}>
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
  const real = (fields: { field: string }[]) =>
    fields.some((f) => !f.field.startsWith("—"));
  const entries = [
    { label: "Consumer-data", fields: ctx.consumer },
    { label: "Intent-data", fields: ctx.intent },
    { label: "Place-data", fields: ctx.place },
    ...(ctx.interaction ? [{ label: "Interaction-data", fields: ctx.interaction }] : []),
  ].filter((e) => real(e.fields));
  const GRID: Record<number, string> = {
    1: "", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4",
  };
  return (
    <div className={`mt-4 grid gap-4 ${GRID[entries.length] ?? ""}`}>
      {entries.map((e) => col(e.label, e.fields))}
    </div>
  );
}

/**
 * EM's Inputs listing — every registry field as a plain chip, grouped by
 * source column. PURE DOCUMENTATION (Pato 2026-07-21: "just mention the data
 * fields — it's not configurable"): live fields render solid, "planned"
 * fields dashed, and the spec's "ignored for now" fields collapse into one
 * muted footnote line per column. Nothing here is clickable; the doc
 * builders always embed every live field.
 */
export function EmContextCols() {
  const col = (label: string, side: ContextSide) => {
    const fields = CONTEXT_FIELDS.filter((f) => f.side === side);
    const ignored = fields.filter((f) => f.status === "ignored");
    return (
      <div>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
          {label}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {fields
            .filter((f) => f.status !== "ignored")
            .map((f) => (
              <span
                key={f.key}
                title={
                  (f.note ? `${f.note} · ` : "") +
                  (f.status === "planned" ? "planned — no data yet" : "in the embedded context")
                }
                className={
                  "rounded-md border px-2 py-0.5 font-mono text-[10.5px] " +
                  (f.status === "planned"
                    ? "border-border/50 text-muted-foreground border-dashed opacity-70"
                    : "border-primary/40 bg-primary/5 text-foreground/90")
                }
              >
                {f.label}
                {f.status === "planned" ? (
                  <span className="text-muted-foreground/80"> · planned</span>
                ) : null}
              </span>
            ))}
        </div>
        {ignored.length > 0 ? (
          <p
            className="text-muted-foreground/70 mt-1.5 font-mono text-[9.5px]"
            title="ignored for now (spec) — never embedded"
          >
            ignored (spec): {ignored.map((f) => f.label).join(" · ")}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {col("Consumer-data", "consumer")}
      {col("Intent-data", "intent")}
      {col("Place-data", "place")}
    </div>
  );
}

/**
 * Per-box Save / Reset / Cancel footer (Pato: every box owns its three
 * buttons, never the whole page). QUIET at rest: only the Reset link renders
 * (still reachable on a clean box); Cancel/Save appear when there is
 * something to act on (dirty · saving · error — NOT savedOk, which would
 * flash disabled pills next to "Saved ✓"). min-h keeps the row layout-stable
 * either way. Save merges this section over the last-saved blob, Cancel
 * reverts only this section, Reset loads this box's code defaults.
 */
export function BoxSaveBar({
  dirty,
  saving,
  savedOk,
  error,
  onSave,
  onCancel,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  savedOk: boolean;
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="border-border/60 mt-4 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t pt-3">
      <span className="flex items-center gap-3 text-xs" aria-live="polite">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground text-[12px] font-semibold underline-offset-2 transition hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Reset to defaults
          </button>
        ) : null}
        {dirty && !saving ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
            Unsaved
          </span>
        ) : savedOk && !saving ? (
          <span className="text-muted-foreground">Saved ✓</span>
        ) : saving ? (
          <span className="text-muted-foreground">Saving…</span>
        ) : null}
        {error ? <span className="font-medium text-red-600">{error}</span> : null}
      </span>
      {dirty || saving || error ? (
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || !dirty}
          className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-8 items-center rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className={
            "inline-flex h-8 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition " +
            (saving || dirty
              ? "bg-pink-gradient shadow-save text-white hover:brightness-105 active:scale-[0.98] disabled:opacity-80"
              : "bg-muted text-muted-foreground")
          }
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      ) : null}
    </div>
  );
}
