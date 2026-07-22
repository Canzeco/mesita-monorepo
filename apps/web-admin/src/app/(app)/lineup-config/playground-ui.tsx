"use client";

import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { LaneId } from "@/lib/business/scores";
import { SAMPLE_MAX } from "@/lib/business/cip";
import { PanelCard } from "./panel-ui";

// Presentational bits shared by both playgrounds. Pure UI — all scoring
// math stays in @/lib/business.

/** The n = 0 state both playgrounds share — nothing in the catalog to score. */
export function EmptyCatalog({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <PanelCard title={title} subtitle={subtitle}>
      <div
        role="status"
        className="border-amber-200/80 bg-amber-50 text-amber-950 mt-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">
            n = 0 — the catalog came back empty (sample ≤ {SAMPLE_MAX}); nothing to score.
          </p>
        </div>
      </div>
    </PanelCard>
  );
}

/** One cell of the specimen bar — tinted icon circle + label + content. */
export function SpecimenCell({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-card rounded-xl border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
          {label}
        </span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// One score, one box: tinted icon circle + title in the header, the RESULT
// headlined top-right, the process in the body.
const SCORE_TINTS = {
  sky: { box: "border-sky-200/70", head: "bg-sky-50 text-sky-950", circle: "bg-sky-600" },
  violet: { box: "border-violet-200/70", head: "bg-violet-50 text-violet-950", circle: "bg-violet-600" },
  emerald: { box: "border-emerald-200/70", head: "bg-emerald-50 text-emerald-950", circle: "bg-emerald-600" },
  amber: { box: "border-amber-200/70", head: "bg-amber-50 text-amber-950", circle: "bg-amber-600" },
  rose: { box: "border-rose-200/70", head: "bg-rose-50 text-rose-950", circle: "bg-rose-600" },
} as const;

export function ScoreBox({
  icon: Icon,
  tint,
  title,
  note,
  result,
  className = "",
  children,
}: {
  icon: LucideIcon;
  tint: keyof typeof SCORE_TINTS;
  title: string;
  note: string;
  result?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = SCORE_TINTS[tint];
  return (
    <section className={`overflow-hidden rounded-2xl border ${t.box} ${className}`}>
      <div className={`flex items-center gap-2.5 px-3.5 py-2 ${t.head}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${t.circle}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-tight font-bold tracking-tight">{title}</p>
          <p className="truncate font-mono text-[9px] leading-tight opacity-70">{note}</p>
        </div>
        {result != null ? (
          <span className="font-display shrink-0 text-lg font-semibold tabular-nums">{result}</span>
        ) : null}
      </div>
      <div className="bg-card px-3.5 py-3">{children}</div>
    </section>
  );
}

/** Lane badge — Organic sky · Inorganic (paid) pink · Hybrid violet. */
const LANE_BADGE_TONES: Record<LaneId, string> = {
  organic: "border-sky-300/80 bg-sky-50 text-sky-700",
  inorganic: "border-pink-300/80 bg-pink-50 text-pink-700",
  hybrid: "border-violet-300/80 bg-violet-50 text-violet-700",
};

export function LaneBadge({ laneId, title }: { laneId: LaneId; title?: string }) {
  return (
    <span
      title={title ?? laneId}
      className={
        "inline-flex w-8 shrink-0 items-center justify-center rounded-md border px-1 py-0.5 font-mono text-[9.5px] font-bold uppercase " +
        LANE_BADGE_TONES[laneId]
      }
    >
      {laneId[0]}
    </span>
  );
}

/** A verbatim context document, labeled. */
export function DocPre({
  label,
  text,
  empty,
  className = "",
}: {
  label: string;
  text: string;
  empty: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground font-mono text-[9px] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <pre className="bg-muted/40 border-border/50 mt-1 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
        {text || empty}
      </pre>
    </div>
  );
}

/** One line of an itemized ledger (GP's volume × quality × floor rows). */
export function LedgerRow({
  label,
  value,
  dim,
  strong,
}: {
  label: string;
  value: string | number;
  dim?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={
        "border-border/40 flex items-baseline justify-between gap-3 border-b px-2.5 py-1 last:border-0 " +
        (strong ? "bg-muted/50" : "") +
        (dim ? " opacity-50" : "")
      }
    >
      <span className={"text-[10.5px] " + (strong ? "font-semibold" : "")}>{label}</span>
      <span className={"font-mono text-[11px] tabular-nums " + (strong ? "font-bold" : "")}>
        {value}
      </span>
    </div>
  );
}

/** The box's bottom line — inputs already shown, this is the arithmetic. */
export function ResultLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border/50 mt-2.5 border-t pt-2 font-mono text-[10.5px] leading-relaxed">
      {children}
    </p>
  );
}

/** One factor row (WW's where/when, GP's volume/quality): inputs · math · value. */
export function FactorRow({
  name,
  inputs,
  math,
  value,
}: {
  name: string;
  inputs: string;
  math: string;
  value: number;
}) {
  return (
    <div className="border-border/40 flex items-center gap-2.5 border-b py-1.5 first:pt-0 last:border-0">
      <span className="text-muted-foreground w-11 shrink-0 font-mono text-[9px] font-bold tracking-[0.08em] uppercase">
        {name}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px]" title={inputs}>{inputs}</span>
        <span className="text-muted-foreground block truncate font-mono text-[9.5px]" title={math}>{math}</span>
      </span>
      <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

/** A vector's semantic profile as a mirrored waveform. Every dim lands in a
 * bin (positive mass drawn up, negative mass down) — aggregation, never
 * sampling: the old strip read 1 dim in ~24 and missed 96% of the vector. */
export function VectorStrip({
  vec,
  mini,
  className = "",
}: {
  vec: number[];
  mini?: boolean;
  className?: string;
}) {
  const bins = mini ? 16 : 96;
  const size = Math.max(1, Math.ceil(vec.length / bins));
  const pos: number[] = [];
  const neg: number[] = [];
  for (let b = 0; b * size < vec.length; b++) {
    let p = 0;
    let n = 0;
    for (let i = b * size; i < Math.min(vec.length, (b + 1) * size); i++) {
      const v = vec[i];
      if (v > 0) p += v;
      else n -= v;
    }
    pos.push(p);
    neg.push(n);
  }
  const max = Math.max(0.0001, ...pos, ...neg);
  return (
    <div
      className={
        "bg-muted/40 border-border/50 relative flex items-stretch gap-px overflow-hidden rounded-md border px-0.5 " +
        (mini ? "h-4" : "h-12") +
        " " +
        className
      }
      title={`${vec.length}d embedding in ${pos.length} bins — up = positive mass, down = negative (every dim counted; emulated feature-hash encoder)`}
    >
      <span className="border-border/60 pointer-events-none absolute inset-x-0 top-1/2 border-t" aria-hidden />
      {pos.map((p, i) => (
        <span key={i} className="relative w-full" aria-hidden>
          {p > 0 ? (
            <span
              className="absolute right-0 bottom-1/2 left-0 rounded-t-[1px] bg-sky-500/70"
              style={{ height: `${Math.max(4, (p / max) * 46)}%` }}
            />
          ) : null}
          {neg[i] > 0 ? (
            <span
              className="absolute top-1/2 right-0 left-0 rounded-b-[1px] bg-pink-500/70"
              style={{ height: `${Math.max(4, (neg[i] / max) * 46)}%` }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** One ENTITY's semantic profile — the document the encoder reads and the
 * vector it becomes, labeled and audited (active dims · unit norm). The two
 * entities Lineup matches: Consumer + Intent (B) and Place (A). */
export function SemanticProfile({
  entity,
  doc,
  empty,
  vec,
  tone,
  className = "",
}: {
  entity: string;
  doc: string;
  empty: string;
  vec: number[];
  tone: "violet" | "emerald" | "sky";
  className?: string;
}) {
  const active = vec.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  const DOT: Record<typeof tone, string> = {
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
  };
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className={"h-2 w-2 shrink-0 self-center rounded-full " + DOT[tone]} aria-hidden />
        <p className="min-w-0 truncate text-[11px] font-semibold">{entity}</p>
        <p className="text-muted-foreground ml-auto shrink-0 font-mono text-[9.5px]">
          {active} active / {vec.length}d · ‖v‖ {norm.toFixed(2)}
        </p>
      </div>
      <DocPre label="document · what the encoder reads" text={doc} empty={empty} className="mt-1.5" />
      <VectorStrip vec={vec} className="mt-2" />
    </div>
  );
}

/** Where the match comes from — per-bin a·b contribution between the two
 * entity vectors. Bars up (emerald) push the cosine up, bars down (rose)
 * pull it down; the strip sums EXACTLY to cos(A, B) before EM's clamp. */
export function MatchStrip({
  a,
  b,
  className = "",
}: {
  a: number[];
  b: number[];
  className?: string;
}) {
  const dims = Math.min(a.length, b.length);
  const size = Math.max(1, Math.ceil(dims / 96));
  const vals: number[] = [];
  let cos = 0;
  for (let bi = 0; bi * size < dims; bi++) {
    let c = 0;
    for (let i = bi * size; i < Math.min(dims, (bi + 1) * size); i++) c += a[i] * b[i];
    vals.push(c);
    cos += c;
  }
  const max = Math.max(0.0001, ...vals.map((v) => Math.abs(v)));
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <p className="text-muted-foreground font-mono text-[9px] font-bold tracking-[0.08em] uppercase">
          match anatomy · per-bin a·b contribution
        </p>
        <p className="text-muted-foreground ml-auto shrink-0 font-mono text-[9.5px]">
          Σ = raw cos(A, B) = {cos.toFixed(3)}
        </p>
      </div>
      <div
        className="bg-muted/40 border-border/50 relative mt-1 flex h-9 items-stretch gap-px overflow-hidden rounded-md border px-0.5"
        title="each bar = one region of the two vectors — up pushes the cosine (and EM) up, down pulls it toward 0"
      >
        <span className="border-border/60 pointer-events-none absolute inset-x-0 top-1/2 border-t" aria-hidden />
        {vals.map((v, i) => (
          <span key={i} className="relative w-full" aria-hidden>
            {v !== 0 ? (
              <span
                className={
                  "absolute right-0 left-0 " +
                  (v > 0
                    ? "bottom-1/2 rounded-t-[1px] bg-emerald-500/70"
                    : "top-1/2 rounded-b-[1px] bg-rose-500/70")
                }
                style={{ height: `${Math.max(4, (Math.abs(v) / max) * 46)}%` }}
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
