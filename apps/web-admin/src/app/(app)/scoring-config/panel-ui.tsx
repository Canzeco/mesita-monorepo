"use client";

import {
  APPLICABLE_SOURCES,
  CONTEXT_FIELDS,
  DATA_SOURCES,
  LANES,
  type ContextSide,
  type DataAccess,
  type DataSourceId,
  type LaneId,
  type SubscoreId,
} from "@/lib/business/scores";

// Tiny presentational bits shared by the Subscores and Scores & Lanes panels.

/** O / I / H badge text — derived from Lane.label, never restated. */
export const LANE_SHORT: Record<LaneId, string> = Object.fromEntries(
  LANES.map((l) => [l.id, l.label[0].toUpperCase()]),
) as Record<LaneId, string>;

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

/** The data-access contract of one fixed subscore — three or four columns
 * of fields (interaction = the consumer × place EDGE, SM-only). */
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
    <div className={`mt-4 grid gap-4 ${ctx.interaction ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {col("Consumer-data", ctx.consumer)}
      {col("Intent-data", ctx.intent)}
      {col("Place-data", ctx.place)}
      {ctx.interaction ? col("Interaction-data", ctx.interaction) : null}
    </div>
  );
}

/**
 * EM's CONFIGURABLE data-access detail: every registry field as a toggle.
 * Enabled fields go into the embedded documents — both playgrounds
 * assemble, embed and score from exactly this set, so a toggle here moves
 * the numbers there. "ignored" fields (the spec's "ignored for now") render
 * greyed and cannot be toggled.
 */
export function ContextConfigCols({
  enabled,
  onToggle,
}: {
  enabled: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const col = (label: string, side: ContextSide) => (
    <div>
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CONTEXT_FIELDS.filter((f) => f.side === side).map((f) => {
          if (f.status === "ignored") {
            return (
              <span
                key={f.key}
                title={f.note ?? "ignored for now (spec)"}
                className="border-border/40 text-muted-foreground/60 rounded-md border border-dashed px-2 py-0.5 font-mono text-[10.5px] opacity-60"
              >
                <span className="line-through">{f.label}</span> · ignored
              </span>
            );
          }
          const isOn = enabled.has(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onToggle(f.key)}
              aria-pressed={isOn}
              title={
                (f.note ? `${f.note} · ` : "") +
                (f.status === "planned" ? "planned — no data yet · " : "") +
                (isOn ? "in the context — click to exclude" : "excluded — click to include")
              }
              className={
                "rounded-md border px-2 py-0.5 font-mono text-[10.5px] transition active:scale-[0.97] " +
                (isOn
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/50 text-muted-foreground border-dashed opacity-70 hover:opacity-100")
              }
            >
              {f.label}
              {f.status === "planned" ? (
                <span className="text-muted-foreground/80"> · planned</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {col("Consumer-data", "consumer")}
      {col("Intent-data", "intent")}
      {col("Place-data", "place")}
    </div>
  );
}

/**
 * ONE subscore's data-access row (Notion spec, "the core config") — lives
 * INSIDE that subscore's box (2026-07-17: the standalone matrix is gone). The
 * subscore's applicable sources toggle ON/off (default all ON); a source it
 * structurally cannot read shows a muted "—". XX reads nothing but its own
 * draw, so it gets a note instead of toggles. Both playgrounds enforce it live.
 */
export function SubscoreDataAccess({
  subscore,
  access,
  onToggle,
}: {
  subscore: SubscoreId;
  access: DataAccess;
  onToggle: (subscore: SubscoreId, source: DataSourceId) => void;
}) {
  const applicable = APPLICABLE_SOURCES[subscore];
  return (
    <div className="border-border/50 mt-4 border-t pt-3">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        Data access · sources this subscore may read
      </p>
      {applicable.length === 0 ? (
        <p className="text-muted-foreground mt-1.5 font-mono text-[10.5px]">
          reads nothing but its own draw — no data sources
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {DATA_SOURCES.map((src) => {
            if (!(applicable as readonly DataSourceId[]).includes(src.id)) {
              return (
                <span
                  key={src.id}
                  title={`structurally cannot read ${src.label} data`}
                  className="border-border/40 text-muted-foreground/50 inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 font-mono text-[10.5px]"
                >
                  {src.label} <span aria-hidden>—</span>
                </span>
              );
            }
            const isOn = access[subscore].includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => onToggle(subscore, src.id)}
                aria-pressed={isOn}
                aria-label={`${subscore.toUpperCase()} reads ${src.label} data`}
                title={
                  (src.blurb ? `${src.blurb} · ` : "") +
                  (isOn ? "reading — click to revoke" : "revoked — click to allow")
                }
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold transition active:scale-[0.97] " +
                  (isOn
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/50 text-muted-foreground border-dashed opacity-60 hover:opacity-100")
                }
              >
                {src.label}
                <span className={isOn ? "text-primary font-bold" : "font-bold"}>
                  {isOn ? "ON" : "off"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Per-box Save / Reset / Cancel footer (Pato: every box owns its three
 * buttons, never the whole page). Always rendered so Reset-to-defaults is
 * reachable even on a clean box; Save/Cancel enable only when the box is
 * dirty. Save merges this section over the last-saved blob (the EF's
 * whole-blob contract holds), Cancel reverts only this section, Reset loads
 * this box's code defaults into the form (dirty until Saved).
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
    <div className="border-border/60 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
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
            Unsaved changes in this box
          </span>
        ) : savedOk && !saving ? (
          <span className="text-muted-foreground">Saved ✓</span>
        ) : saving ? (
          <span className="text-muted-foreground">Saving…</span>
        ) : null}
        {error ? <span className="font-medium text-red-600">{error}</span> : null}
      </span>
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
    </div>
  );
}
