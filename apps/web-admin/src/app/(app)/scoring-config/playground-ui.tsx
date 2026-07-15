"use client";

import {
  AlertTriangle,
  GalleryHorizontalEnd,
  Map as MapIcon,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { EngineId } from "@/lib/business/scores";
import { SAMPLE_MAX } from "@/lib/business/cip";
import { PanelCard } from "./panel-ui";

// Presentational bits shared by the two playground subpages (Internals and
// Engines). Pure UI — all scoring math stays in @/lib/business.

export const ENGINE_ICONS: Record<EngineId, LucideIcon> = {
  swipe: GalleryHorizontalEnd,
  map: MapIcon,
  memo: MessagesSquare,
};

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
          <p className="font-semibold">n = 0 — no places to score.</p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            The playground draws a random sample of up to {SAMPLE_MAX} places from the catalog, and
            the catalog came back empty. The model still stands; there is simply nothing to run it
            on.
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

/** A small labeled fact (consumer trait, intent slot). */
export function FactChip({
  label,
  value,
  warn,
  strong,
}: {
  label?: string;
  value: string;
  warn?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 " +
        (warn ? "border-amber-300/80 bg-amber-50 text-amber-900" : "border-border/60 bg-muted/50")
      }
    >
      {label ? <span className="text-muted-foreground font-mono text-[8.5px] font-bold uppercase">{label}</span> : null}
      <span className={"font-mono text-[10.5px]" + (strong ? " font-semibold" : "")}>{value}</span>
    </span>
  );
}

/** One sub-score, its own labeled cell — RM · LM · WWW · P read as four boxes. */
export function ScoreCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div title={hint} className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
      <p className="text-muted-foreground font-mono text-[8.5px] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">{value}</p>
    </div>
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

/** One line of the judge's itemized verdict. */
export function JudgeRow({
  label,
  value,
  dim,
  strong,
}: {
  label: string;
  value: number;
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
        {!strong && value > 0 ? `+${value}` : value}
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

/** A centered "→ result" connector between two blocks. */
export function ConnectorPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
      <span className="border-border/70 bg-muted rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold">
        {children}
      </span>
      <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
    </div>
  );
}

/** One WWW factor: its inputs, its math, its value. */
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

/** One promo rate, labeled. */
export function RateCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
      <p className="text-muted-foreground font-mono text-[8px] font-bold tracking-[0.04em] uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">
        {value != null ? `${value}%` : "—"}
      </p>
    </div>
  );
}

/** A generated vector as a mirrored waveform: bars up = positive slots,
 * bars down = negative, around a faint baseline. */
export function VectorStrip({
  vec,
  mini,
  className = "",
}: {
  vec: number[];
  mini?: boolean;
  className?: string;
}) {
  const bins = mini ? 16 : 64;
  const step = Math.max(1, Math.floor(vec.length / bins));
  const vals: number[] = [];
  for (let i = 0; i < vec.length; i += step) vals.push(vec[i]);
  const max = Math.max(0.0001, ...vals.map((v) => Math.abs(v)));
  return (
    <div
      className={
        "bg-muted/40 border-border/50 relative flex items-stretch gap-px overflow-hidden rounded-md border px-0.5 " +
        (mini ? "h-4" : "h-9") +
        " " +
        className
      }
      title={`${vec.length}d feature-hash embedding (emulated) — up = positive slot, down = negative`}
    >
      <span className="border-border/60 pointer-events-none absolute inset-x-0 top-1/2 border-t" aria-hidden />
      {vals.map((v, i) => {
        const h = Math.max(6, (Math.abs(v) / max) * 46);
        return (
          <span key={i} className="relative w-full" aria-hidden>
            <span
              className={
                "absolute right-0 left-0 " +
                (v >= 0 ? "bottom-1/2 rounded-t-[1px] bg-sky-500/70" : "top-1/2 rounded-b-[1px] bg-pink-500/70")
              }
              style={{ height: `${h}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}
