"use client";

import {
  APPLICABLE_SOURCES,
  CONTEXT_FIELDS,
  DATA_SOURCES,
  LANES,
  SUBSCORE_BY_ID,
  SUBSCORES,
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

// ── Subscore identity — one learnable colour per subscore (EM · SM · GP · RP
// · XX). Static class strings (Tailwind JIT reads the literals), used by the
// overview strip, the per-subscore card headers and the coloured lane
// formulas so a subscore reads the SAME everywhere. Distinct from the lane
// badges (sky/pink/violet) on purpose — RP/pink echoing the inorganic lane is
// meaning, not collision.
export const SUBSCORE_TINT: Record<SubscoreId, { chip: string; text: string }> = {
  em: { chip: "bg-indigo-500", text: "text-indigo-600" },
  sm: { chip: "bg-teal-500", text: "text-teal-600" },
  gp: { chip: "bg-amber-500", text: "text-amber-600" },
  rp: { chip: "bg-pink-600", text: "text-pink-700" },
  xx: { chip: "bg-slate-500", text: "text-slate-600" },
};

/** The five subscores as a legend + jump strip — the model's spine at a
 * glance. Each pill anchors to its card (`#sub-<id>`). */
export function SubscoreOverview() {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {SUBSCORES.map((s) => (
          <a
            key={s.id}
            href={`#sub-${s.id}`}
            className="border-border/70 bg-muted/40 hover:bg-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition active:scale-[0.98]"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md font-mono text-[10px] font-bold text-white ${SUBSCORE_TINT[s.id].chip}`}
            >
              {s.short}
            </span>
            <span className="text-[13px] font-semibold">{s.name}</span>
          </a>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Five subscores, each in [0,1]. Three lanes multiply their own subset into one score, then
        merge into the final deck on{" "}
        <span className="text-foreground/70 font-semibold">Scores &amp; Lanes</span>. Tune each
        subscore below.
      </p>
    </section>
  );
}

/** A subscore's card — identity header (colour chip + canonical name) over the
 * shared shell. `blurb` is ONE line; the full rationale lives in scores.ts. */
export function SubscoreCard({
  id,
  blurb,
  pill,
  children,
}: {
  id: SubscoreId;
  blurb: string;
  pill?: string;
  children: React.ReactNode;
}) {
  const def = SUBSCORE_BY_ID[id];
  const t = SUBSCORE_TINT[id];
  return (
    <section
      id={`sub-${id}`}
      className="border-border bg-card shadow-card scroll-mt-24 rounded-2xl border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-[13px] font-bold text-white ${t.chip}`}
          >
            {def.short}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">{def.name}</h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">{blurb}</p>
          </div>
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

/** A lane's formula with each subscore in its identity colour — EM·SM·GP·XX. */
export function SubscoreFormula({ parts }: { parts: readonly SubscoreId[] }) {
  return (
    <span className="inline-flex flex-wrap items-center font-mono text-[13px] font-semibold tracking-tight">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center">
          <span className={SUBSCORE_TINT[p].text}>{SUBSCORE_BY_ID[p].short}</span>
          {i < parts.length - 1 ? <span className="text-muted-foreground/40 px-1">·</span> : null}
        </span>
      ))}
    </span>
  );
}

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
 * THE CORE CONFIG (Notion spec): the data-access matrix — one row per
 * subscore, one column per data source. Applicable cells toggle ON/OFF
 * (default all ON); a source a subscore structurally cannot read renders as
 * "—". Both playgrounds enforce the matrix live.
 */
export function DataAccessMatrix({
  access,
  onToggle,
}: {
  access: DataAccess;
  onToggle: (subscore: SubscoreId, source: DataSourceId) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase">
              Subscore
            </th>
            {DATA_SOURCES.map((src) => (
              <th
                key={src.id}
                className="text-muted-foreground pb-2 text-center text-[10px] font-bold tracking-[0.12em] uppercase"
                title={src.blurb}
              >
                {src.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUBSCORES.map((sub) => (
            <tr key={sub.id}>
              <td className="border-border/50 border-t py-2 pr-3">
                <span className="font-mono text-[12px] font-bold">{sub.short}</span>
                <span className="text-muted-foreground ml-2 hidden text-[11px] sm:inline">
                  {sub.name}
                </span>
              </td>
              {DATA_SOURCES.map((src) => {
                const applicable = APPLICABLE_SOURCES[sub.id].includes(src.id);
                if (!applicable) {
                  return (
                    <td
                      key={src.id}
                      className="border-border/50 text-muted-foreground/50 border-t py-2 text-center font-mono text-[11px]"
                      title={`${sub.short} structurally cannot read ${src.label} data`}
                    >
                      —
                    </td>
                  );
                }
                const isOn = access[sub.id].includes(src.id);
                return (
                  <td key={src.id} className="border-border/50 border-t py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onToggle(sub.id, src.id)}
                      aria-pressed={isOn}
                      aria-label={`${sub.short} reads ${src.label} data`}
                      title={
                        isOn
                          ? `${sub.short} reads ${src.label} data — click to revoke`
                          : `${src.label} data revoked for ${sub.short} — click to allow`
                      }
                      className={
                        "inline-flex h-6 min-w-12 items-center justify-center rounded-full border px-2 font-mono text-[10px] font-bold transition active:scale-[0.96] " +
                        (isOn
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground border-dashed opacity-60 hover:opacity-100")
                      }
                    >
                      {isOn ? "ON" : "off"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Per-box Save/Cancel footer (Pato: every box saves ITSELF, never the whole
 * page). Renders only when the box's section is dirty; Save merges this
 * section over the last-saved blob (the EF's whole-blob contract holds),
 * Cancel reverts only this section.
 */
export function BoxSaveBar({
  dirty,
  saving,
  savedOk,
  error,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  saving: boolean;
  savedOk: boolean;
  error?: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!dirty && !saving && !savedOk && !error) return null;
  return (
    <div className="border-border/60 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <span className="text-xs" aria-live="polite">
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
        {error ? <span className="ml-2 font-medium text-red-600">{error}</span> : null}
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
