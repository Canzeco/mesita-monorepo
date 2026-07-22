"use client";

import type { CardTint } from "./panel-ui";

// Live formula plots for the Subscores Process sections (Pato 2026-07-21):
// every subscore output is [0,1], so Y is always [0,1]; each plot reads the
// CURRENT knobs, so dragging a slider reshapes the curve in place. Monochrome
// in the box's own tint — the shape lives next to the formula text.

const TONE_TEXT: Record<CardTint, string> = {
  sky: "text-sky-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
  violet: "text-violet-500",
};
const TONE_BAR: Record<CardTint, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

function PlotTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/70 font-mono text-[10px] font-semibold">{children}</p>;
}

/** A continuous [0,1]-valued curve sampled over [x0,x1] (optionally log-x),
 * with dot markers at named x's. The curve, frame and markers are all the
 * box tint via currentColor. */
export function CurvePlot({
  f,
  x0,
  x1,
  tone,
  logX = false,
  markers = [],
  xLabel,
  caption,
  title,
}: {
  f: (x: number) => number;
  x0: number;
  x1: number;
  tone: CardTint;
  logX?: boolean;
  markers?: { x: number }[];
  xLabel: string;
  caption?: string;
  title?: string;
}) {
  const W = 260;
  const H = 60;
  const PAD = 3;
  const N = 72;
  const clamp01v = (v: number) => Math.max(0, Math.min(1, v));
  const xAt = (t: number) => (logX ? x0 * Math.pow(x1 / x0, t) : x0 + t * (x1 - x0));
  const tOf = (x: number) =>
    logX ? Math.log(x / x0) / Math.log(x1 / x0) : (x - x0) / (x1 - x0);
  const px = (t: number) => PAD + Math.max(0, Math.min(1, t)) * (W - 2 * PAD);
  const py = (y: number) => H - PAD - clamp01v(y) * (H - 2 * PAD);

  let d = "";
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    d += (i === 0 ? "M" : "L") + px(t).toFixed(1) + " " + py(f(xAt(t))).toFixed(1);
  }

  return (
    <div className="mt-1 min-w-0">
      {title ? <PlotTitle>{title}</PlotTitle> : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={"mt-1 w-full max-w-[260px] " + TONE_TEXT[tone]}
        role="img"
        aria-label={`${xLabel}${caption ? " · " + caption : ""}`}
      >
        <line x1={PAD} y1={py(1)} x2={W - PAD} y2={py(1)} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.2" />
        <line x1={PAD} y1={py(0)} x2={W - PAD} y2={py(0)} stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {markers.map((m, i) => (
          <circle key={i} cx={px(tOf(m.x))} cy={py(f(m.x))} r="2.75" fill="currentColor" />
        ))}
      </svg>
      <p className="text-muted-foreground mt-0.5 font-mono text-[9px] leading-tight">
        {xLabel}
        {caption ? <span className="opacity-70"> · {caption}</span> : null}
      </p>
    </div>
  );
}

/** A categorical [0,1] rung chart — the what ladder, RP's posture rungs. */
export function LadderPlot({
  bars,
  tone,
  caption,
  title,
}: {
  bars: { label: string; value: number }[];
  tone: CardTint;
  caption?: string;
  title?: string;
}) {
  return (
    <div className="mt-1 min-w-0 max-w-[260px]">
      {title ? <PlotTitle>{title}</PlotTitle> : null}
      <div className="mt-1 flex items-end gap-2">
        {bars.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center">
            <span className="font-mono text-[9px] tabular-nums leading-none">{b.value.toFixed(2)}</span>
            <div className="mt-0.5 flex w-full items-end justify-center" style={{ height: 46 }}>
              <div
                className={"w-full rounded-t-sm " + TONE_BAR[tone]}
                style={{ height: Math.max(2, Math.min(1, b.value) * 46) }}
              />
            </div>
            <span className="text-muted-foreground mt-0.5 text-center font-mono text-[8.5px] leading-tight">
              {b.label}
            </span>
          </div>
        ))}
      </div>
      {caption ? (
        <p className="text-muted-foreground mt-0.5 font-mono text-[9px]">{caption}</p>
      ) : null}
    </div>
  );
}
