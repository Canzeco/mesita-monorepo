"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Users } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import {
  DEFAULT_ASSUMPTIONS,
  SIMULATED_VISITS,
  distributionFor,
  type Assumptions,
  type StrategyDistribution,
} from "./distribution-model";
import { usePromosState } from "./PromosState";
import {
  CLASS_KEYS,
  CLASS_META,
  LIVE_STRATEGY_KEYS,
  STRATEGY_META,
  type ClassKey,
  type StrategyKey,
} from "./promos";

// Promos · Distribution — visit-spread simulator on the same page as the
// knobs. Assumptions stay local; rates follow live PromosState so an unsaved
// ladder is what the chart quotes. No random sampling (MESITA-991 / 996).
//
// Chart grammar, chosen so labels can NEVER collide (MESITA-996): no text is
// positioned at a data x. The quartiles read as a shaded IQR band plus one
// median rule; their numbers live in the chips above, which are the single
// source. A smoothed curve over the bars carries the distribution's shape,
// which is what the operator actually reads at a glance.

// Single-hue lightness ramp per strategy — darker = fewer bonuses stacked.
// Index matches DistributionPoint.byBonusCount: [base only, 1 bonus, 2+].
const STRATEGY_RAMP: Record<StrategyKey, [string, string, string]> = {
  conservative: ["#3E63DD", "#7C96EB", "#B6C4F4"],
  aggressive: ["#CE4444", "#E08383", "#F2C0C0"],
  dominant: ["#8347B9", "#AC7FD1", "#D5BCE8"],
};

const BONUS_SEGMENT_LABEL = ["Base only", "+1 bonus", "+2 or more"] as const;

export function PromosDistributionClient() {
  const { cfg, loadBlocked, error } = usePromosState();
  const loadError = loadBlocked ? error : null;
  const [assumptions, setAssumptions] =
    useState<Assumptions>(DEFAULT_ASSUMPTIONS);

  const results = useMemo(() => {
    const out = {} as Record<
      (typeof LIVE_STRATEGY_KEYS)[number],
      StrategyDistribution
    >;
    for (const s of LIVE_STRATEGY_KEYS) {
      out[s] = distributionFor(cfg, assumptions, s);
    }
    return out;
  }, [cfg, assumptions]);

  const classSum = CLASS_KEYS.reduce((t, c) => t + assumptions.classPct[c], 0);

  const setClassPct = (cls: ClassKey, v: number) =>
    setAssumptions((a) => ({ ...a, classPct: { ...a.classPct, [cls]: v } }));

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorNote
          message={`Failed to load the saved Rewards config — simulating over launch defaults. (${loadError})`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<FlaskConical className="text-secondary h-4 w-4" />}
          title="Visit assumptions"
          subtitle="Share of visits that earn each bonus."
        >
          <div className="mt-4">
            <PctField
              label="First visits"
              value={assumptions.welcomePct}
              onChange={(v) => setAssumptions((a) => ({ ...a, welcomePct: v }))}
            />
            <PctField
              label="Instagram Story"
              value={assumptions.actionPct.story}
              onChange={(v) =>
                setAssumptions((a) => ({
                  ...a,
                  actionPct: { ...a.actionPct, story: v },
                }))
              }
            />
            <PctField
              label="Google Review"
              value={assumptions.actionPct.google}
              onChange={(v) =>
                setAssumptions((a) => ({
                  ...a,
                  actionPct: { ...a.actionPct, google: v },
                }))
              }
            />
            <PctField
              label="Mesita Review"
              value={assumptions.actionPct.mesita}
              onChange={(v) =>
                setAssumptions((a) => ({
                  ...a,
                  actionPct: { ...a.actionPct, mesita: v },
                }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Users className="text-secondary h-4 w-4" />}
          title="Class mix"
          subtitle="Share of visits per class."
        >
          <div className="mt-4">
            {CLASS_KEYS.map((cls) => (
              <PctField
                key={cls}
                label={CLASS_META[cls].name}
                value={assumptions.classPct[cls]}
                onChange={(v) => setClassPct(cls, v)}
              />
            ))}
          </div>
          {classSum !== 100 && (
            <p className="text-secondary mt-3 type-label font-semibold">
              Sums to {classSum}% — normalized proportionally.
            </p>
          )}
        </SectionCard>

        <SectionCard
          icon={<Users className="text-secondary h-4 w-4" />}
          title="Plan mix"
          subtitle="Share of visits on Premium. Free is the rest."
        >
          <div className="mt-4">
            <PctField
              label="Premium"
              value={assumptions.premiumPct}
              onChange={(v) =>
                setAssumptions((a) => ({ ...a, premiumPct: v }))
              }
            />
            <p className="text-muted-foreground type-label pt-2">
              Free {100 - assumptions.premiumPct}%
            </p>
          </div>
        </SectionCard>
      </div>

      {LIVE_STRATEGY_KEYS.map((s) => (
        <DistributionCard
          key={s}
          strategy={s}
          result={results[s]}
          ramp={STRATEGY_RAMP[s]}
        />
      ))}

      <p className="text-muted-foreground type-label">
        Exact expected mix of {SIMULATED_VISITS.toLocaleString("en-US")} visits
        on the saved config — no sampling.
      </p>
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 last:border-0">
      <span className="text-foreground type-body font-medium">{label}</span>
      <label className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={`${label} — share of visits`}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (Number.isNaN(raw)) return;
            onChange(Math.max(0, Math.min(100, Math.round(raw))));
          }}
          className="border-border bg-card focus:border-foreground h-9 w-20 rounded-lg border px-2 text-right type-body font-semibold tabular-nums outline-none"
        />
        <span className="text-muted-foreground text-xs">%</span>
      </label>
    </div>
  );
}

function DistributionCard({
  strategy,
  result,
  ramp,
}: {
  strategy: StrategyKey;
  result: StrategyDistribution;
  ramp: [string, string, string];
}) {
  const meta = STRATEGY_META[strategy];
  return (
    <div className="border-border bg-card rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-foreground text-sm font-bold">
          <span
            aria-hidden
            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-baseline"
            style={{ backgroundColor: ramp[0] }}
          />
          {meta.name}
        </h3>
        <span className="text-muted-foreground ml-auto text-xs">
          Expected discount{" "}
          <span className="text-foreground font-mono font-bold tabular-nums">
            {result.mean.toFixed(1)}%
          </span>
        </span>
      </div>

      {/* The quartile numbers live HERE, once — never on the plot. */}
      <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 type-label">
        {(
          [
            ["Min", result.min],
            ["Q1", result.q1],
            ["Median", result.median],
            ["Q3", result.q3],
            ["Max", result.max],
          ] as const
        ).map(([label, v]) => (
          <span key={label}>
            {label}{" "}
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {v}%
            </span>
          </span>
        ))}
      </div>

      <DistributionChart strategy={strategy} result={result} ramp={ramp} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {BONUS_SEGMENT_LABEL.map((label, i) => (
          <span
            key={label}
            className="text-muted-foreground inline-flex items-center gap-1.5 type-label"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: ramp[i] }}
            />
            {label}
          </span>
        ))}
        <span className="text-muted-foreground/70 ml-auto type-label">
          Shaded band = middle half of visits (Q1–Q3)
        </span>
      </div>

      <details className="mt-3">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer type-label select-none">
          View as table
        </summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full max-w-lg border-collapse text-xs">
            <thead>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-1 text-left type-meta font-bold tracking-[0.12em] uppercase"
                >
                  Reward
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground pb-1 text-right type-meta font-bold tracking-[0.12em] uppercase"
                >
                  Visits
                </th>
                {BONUS_SEGMENT_LABEL.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="text-muted-foreground pb-1 text-right type-meta font-bold tracking-[0.12em] uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.dist.map((d) => (
                <tr
                  key={d.value}
                  className="border-border border-b last:border-0"
                >
                  <td className="py-1 font-mono tabular-nums">{d.value}%</td>
                  <td className="py-1 text-right font-mono font-semibold tabular-nums">
                    {Math.round(d.visits)}
                  </td>
                  {d.byBonusCount.map((v, i) => (
                    <td
                      key={i}
                      className="py-1 text-right font-mono tabular-nums"
                    >
                      {Math.round(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * A smooth path through the points via Catmull-Rom → cubic Bézier. Tension
 * 0.5 is the standard centripetal-ish feel; endpoints are duplicated so the
 * curve starts and ends on real data rather than drifting.
 */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Bars stacked by bonus count under a smoothed shape curve, on a fixed
// 0–100% axis shared by both strategies. Quartiles are a shaded band + a
// median rule; NO text sits inside the plot, so nothing can ever overlap.
function DistributionChart({
  strategy,
  result,
  ramp,
}: {
  strategy: StrategyKey;
  result: StrategyDistribution;
  ramp: [string, string, string];
}) {
  const W = 720;
  const H = 180;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseline = padT + plotH;

  const xFor = (v: number) => padL + (v / 100) * plotW;
  const yMaxRaw = Math.max(...result.dist.map((d) => d.visits), 1);
  const yMax = Math.max(100, Math.ceil(yMaxRaw / 100) * 100);
  const yFor = (n: number) => padT + plotH - (n / yMax) * plotH;

  const slotW = plotW / 21;
  const barW = Math.max(5, slotW - 4);

  // The shape curve rides the bar tops, padded with a zero at each end so it
  // resolves to the baseline instead of hanging in the air.
  const curvePts = [
    { x: xFor(Math.max(0, result.min - 5)), y: baseline },
    ...result.dist.map((d) => ({ x: xFor(d.value), y: yFor(d.visits) })),
    { x: xFor(Math.min(100, result.max + 5)), y: baseline },
  ];

  return (
    <div className="-mx-5 mt-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[520px]"
        role="img"
        aria-label={`${STRATEGY_META[strategy].name}: expected visits by total reward. Median ${result.median}%, middle half ${result.q1}% to ${result.q3}%.`}
      >
        {/* IQR band — the middle half of visits, behind everything. */}
        <rect
          x={xFor(result.q1)}
          y={padT}
          width={Math.max(xFor(result.q3) - xFor(result.q1), 1)}
          height={plotH}
          fill="var(--muted-foreground)"
          opacity={0.07}
        />

        {/* Two gridlines only — the shape carries the reading, not the ticks. */}
        {[0.5, 1].map((f) => {
          const y = yFor(yMax * f);
          return (
            <g key={f}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--muted-foreground)"
              >
                {yMax * f}
              </text>
            </g>
          );
        })}
        <line
          x1={padL}
          x2={W - padR}
          y1={baseline}
          y2={baseline}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Bars — stacked by bonus count, base-only at the bottom. */}
        {result.dist.map((d) => {
          const x = xFor(d.value) - barW / 2;
          const tooltip = `${d.value}% — ${Math.round(d.visits)} visits · base only ${Math.round(d.byBonusCount[0])} · 1 bonus ${Math.round(d.byBonusCount[1])} · 2+ ${Math.round(d.byBonusCount[2])}`;
          let cum = 0;
          return (
            <g key={d.value}>
              {d.byBonusCount.map((seg, i) => {
                if (seg <= 0) return null;
                const y0 = yFor(cum);
                cum += seg;
                const y1 = yFor(cum);
                const gap = y0 < baseline - 0.1 ? 1.5 : 0;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y1}
                    width={barW}
                    height={Math.max(y0 - y1 - gap, 0.75)}
                    rx={1.5}
                    fill={ramp[i]}
                    opacity={0.55}
                  >
                    <title>{tooltip}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* The shape curve — what the eye actually reads. */}
        <path
          d={smoothPath(curvePts)}
          fill="none"
          stroke={ramp[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Median rule — the only vertical marker, and it carries no text. */}
        <line
          x1={xFor(result.median)}
          x2={xFor(result.median)}
          y1={padT}
          y2={baseline}
          stroke="var(--foreground)"
          strokeWidth={1.25}
          strokeDasharray="4 3"
          opacity={0.55}
        />

        {/* x ticks every 20% — the only text, safely below the plot. */}
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <text
            key={v}
            x={xFor(v)}
            y={H - 5}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-foreground)"
          >
            {v}%
          </text>
        ))}
      </svg>
    </div>
  );
}
