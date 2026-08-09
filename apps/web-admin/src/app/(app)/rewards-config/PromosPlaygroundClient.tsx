"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Info, Users } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "../enricher-config/atlas-ui";
import {
  DEFAULT_ASSUMPTIONS,
  SIMULATED_VISITS,
  distributionFor,
  type Assumptions,
  type StrategyDistribution,
} from "./distribution";
import {
  CLASS_KEYS,
  CLASS_META,
  STRATEGY_KEYS,
  STRATEGY_META,
  type ClassKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

// Promos Playground (MESITA-991) — the reward-distribution simulator. The
// operator sets assumptions; the chart shows the EXACT expected distribution
// (every class × visit-type × action combination enumerated and weighted —
// no random sampling, so nothing jitters). One small-multiple chart per
// strategy on a shared 0–100% axis; strategy hues match the console's
// Conservative/Aggressive identity.

const STRATEGY_HUE: Record<StrategyKey, string> = {
  conservative: "#3E63DD",
  aggressive: "#CE4444",
};

export function PromosPlaygroundClient({
  initialConfig,
  loadError,
}: {
  initialConfig: PromosConfig;
  loadError: string | null;
}) {
  const [assumptions, setAssumptions] =
    useState<Assumptions>(DEFAULT_ASSUMPTIONS);

  const results = useMemo(() => {
    const out = {} as Record<StrategyKey, StrategyDistribution>;
    for (const s of STRATEGY_KEYS) {
      out[s] = distributionFor(initialConfig, assumptions, s);
    }
    return out;
  }, [initialConfig, assumptions]);

  const classSum = CLASS_KEYS.reduce(
    (t, c) => t + assumptions.classPct[c],
    0,
  );

  const setClassPct = (cls: ClassKey, v: number) =>
    setAssumptions((a) => ({
      ...a,
      classPct: { ...a.classPct, [cls]: v },
    }));

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorNote
          message={`Failed to load the saved Promos config — simulating over launch defaults. (${loadError})`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<FlaskConical className="text-secondary h-4 w-4" />}
          title="Visit & action assumptions"
          subtitle="Per-visit probabilities. First visits earn the Welcome bonus; each action is independent."
        >
          <div className="mt-4 space-y-1">
            <PctField
              label="First visits"
              hint="Guest's first verified ticket at the place"
              value={assumptions.welcomePct}
              onChange={(v) =>
                setAssumptions((a) => ({ ...a, welcomePct: v }))
              }
            />
            <PctField
              label="Mesita Review"
              hint="Leaves an in-app rating"
              value={assumptions.actionPct.mesita}
              onChange={(v) =>
                setAssumptions((a) => ({
                  ...a,
                  actionPct: { ...a.actionPct, mesita: v },
                }))
              }
            />
            <PctField
              label="Instagram Story"
              hint="Posts a tagged story"
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
              hint="Leaves a Google review"
              value={assumptions.actionPct.google}
              onChange={(v) =>
                setAssumptions((a) => ({
                  ...a,
                  actionPct: { ...a.actionPct, google: v },
                }))
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Users className="text-secondary h-4 w-4" />}
          title="Class mix"
          subtitle="Share of the 1,000 visits per class."
        >
          <div className="mt-4 space-y-1">
            {CLASS_KEYS.map((cls) => (
              <PctField
                key={cls}
                label={`${CLASS_META[cls].emoji} ${CLASS_META[cls].name}`}
                value={assumptions.classPct[cls]}
                onChange={(v) => setClassPct(cls, v)}
              />
            ))}
          </div>
          <p
            className={
              "mt-3 text-[11px] " +
              (classSum === 100
                ? "text-muted-foreground"
                : "text-secondary font-semibold")
            }
          >
            {classSum === 100
              ? "Class mix sums to 100%."
              : `Class mix sums to ${classSum}% — shares are normalized proportionally.`}
          </p>
        </SectionCard>
      </div>

      {STRATEGY_KEYS.map((s) => (
        <DistributionCard
          key={s}
          strategy={s}
          result={results[s]}
          hue={STRATEGY_HUE[s]}
        />
      ))}

      <p className="text-muted-foreground/80 flex items-start gap-1.5 text-[11px] leading-snug">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Simulates the v10 ADDITIVE model over the saved Config (base + welcome
        + each earned action bonus, capped at 100%). The live engine pays
        best-of until MESITA-992 ships, so real bills today can only pay less
        than this simulation.
      </p>
    </div>
  );
}

function PctField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-foreground text-[13px] font-semibold">{label}</p>
        {hint ? (
          <p className="text-muted-foreground truncate text-[11px]">{hint}</p>
        ) : null}
      </div>
      <label className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={`${label} percentage`}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (Number.isNaN(raw)) return;
            onChange(Math.max(0, Math.min(100, Math.round(raw))));
          }}
          className="border-border bg-card focus:border-foreground h-9 w-20 rounded-lg border px-2 text-right text-[13px] font-semibold tabular-nums outline-none"
        />
        <span className="text-muted-foreground text-xs">%</span>
      </label>
    </div>
  );
}

function DistributionCard({
  strategy,
  result,
  hue,
}: {
  strategy: StrategyKey;
  result: StrategyDistribution;
  hue: string;
}) {
  const meta = STRATEGY_META[strategy];
  return (
    <div className="border-border bg-card rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-foreground text-sm font-bold">
          <span
            aria-hidden
            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-baseline"
            style={{ backgroundColor: hue }}
          />
          {meta.emoji} {meta.name}
        </h3>
        <span className="text-muted-foreground ml-auto text-xs">
          Expected discount{" "}
          <span className="text-foreground font-mono font-bold tabular-nums">
            {result.mean.toFixed(1)}%
          </span>{" "}
          of every capped bill
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["Min", result.min],
            ["Q1", result.q1],
            ["Median", result.median],
            ["Q3", result.q3],
            ["Max", result.max],
          ] as const
        ).map(([label, v]) => (
          <span
            key={label}
            className="border-border text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px]"
          >
            {label}{" "}
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {v}%
            </span>
          </span>
        ))}
      </div>

      <DistributionChart strategy={strategy} result={result} hue={hue} />

      <details className="mt-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] select-none">
          View as table
        </summary>
        <table className="mt-2 w-full max-w-sm border-collapse text-[12px]">
          <thead>
            <tr className="border-border border-b-2">
              <th
                scope="col"
                className="text-muted-foreground pb-1 text-left text-[10px] font-bold tracking-[0.1em] uppercase"
              >
                Reward
              </th>
              <th
                scope="col"
                className="text-muted-foreground pb-1 text-right text-[10px] font-bold tracking-[0.1em] uppercase"
              >
                Visits of {SIMULATED_VISITS.toLocaleString("en-US")}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.dist.map((d) => (
              <tr key={d.value} className="border-border border-b last:border-0">
                <td className="py-1 font-mono tabular-nums">{d.value}%</td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {Math.round(d.visits)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// One small-multiple histogram: bars per 5% reward value on a fixed 0–100%
// axis (shared across strategies so the two charts compare), dashed Q1 /
// Median / Q3 markers, per-bar <title> tooltips.
function DistributionChart({
  strategy,
  result,
  hue,
}: {
  strategy: StrategyKey;
  result: StrategyDistribution;
  hue: string;
}) {
  const W = 720;
  const H = 190;
  const padL = 40;
  const padR = 10;
  const padT = 24;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xFor = (v: number) => padL + (v / 100) * plotW;
  const yMaxRaw = Math.max(...result.dist.map((d) => d.visits), 1);
  const yMax = Math.max(100, Math.ceil(yMaxRaw / 100) * 100);
  const yFor = (n: number) => padT + plotH - (n / yMax) * plotH;

  const slotW = plotW / 21;
  const barW = Math.max(6, slotW - 3);

  const quartiles: Array<[string, number, boolean]> = [
    ["Q1", result.q1, false],
    ["Med", result.median, true],
    ["Q3", result.q3, false],
  ];

  return (
    <div className="mt-3 overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[560px]"
        role="img"
        aria-label={`${STRATEGY_META[strategy].name}: expected visits by total reward across ${SIMULATED_VISITS} visits`}
      >
        {/* gridlines + y labels */}
        {[0, 1, 2, 3, 4].map((i) => {
          const n = (yMax / 4) * i;
          const y = yFor(n);
          return (
            <g key={i}>
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
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {n}
              </text>
            </g>
          );
        })}
        {/* x ticks every 20% */}
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <text
            key={v}
            x={xFor(v)}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted-foreground)"
          >
            {v}%
          </text>
        ))}
        {/* bars */}
        {result.dist.map((d) => {
          const x = xFor(d.value) - barW / 2;
          const y = yFor(d.visits);
          const h = padT + plotH - y;
          return (
            <rect
              key={d.value}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, d.visits > 0 ? 1.5 : 0)}
              rx={2}
              fill={hue}
            >
              <title>
                {`${d.value}% reward — ${Math.round(d.visits)} visits (${(d.visits / (SIMULATED_VISITS / 100)).toFixed(1)}%)`}
              </title>
            </rect>
          );
        })}
        {/* quartile markers */}
        {quartiles.map(([label, v, emphasized]) => (
          <g key={label}>
            <line
              x1={xFor(v)}
              x2={xFor(v)}
              y1={padT - 2}
              y2={padT + plotH}
              stroke="var(--muted-foreground)"
              strokeWidth={emphasized ? 1.5 : 1}
              strokeDasharray="3 3"
            />
            <text
              x={xFor(v)}
              y={padT - 8}
              textAnchor="middle"
              fontSize={10}
              fontWeight={emphasized ? 700 : 500}
              fill="var(--muted-foreground)"
            >
              {label} {v}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
