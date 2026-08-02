"use client";

import { useState } from "react";
import { Gift, Trophy } from "lucide-react";
import { ErrorNote, SectionCard } from "../enricher-config/atlas-ui";
import {
  POSTURES,
  SEGMENTS,
  type RewardPosture,
  type RewardSegmentKey,
  type RewardsConfig,
} from "./catalog";

// Rewards Playground — a read-only best-of calculator. Pick the place's posture,
// the rungs the guest qualifies for, and a bill, and see the single discount the
// grid pays (best-of, never stacked). Pure client compute against the saved grid
// — nothing here writes config or hits an EF.

// Standard is the base class every guest inherits; the rest are opt-in rungs.
const OPTIONAL = SEGMENTS.filter((s) => s.key !== "standard");

const inputCls =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm outline-none";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-border bg-background rounded-xl border p-4">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {sub && <p className="text-muted-foreground/80 mt-0.5 text-[11px]">{sub}</p>}
    </div>
  );
}

export function RewardsPlaygroundClient({
  config,
  loadError,
}: {
  config: RewardsConfig;
  loadError: string | null;
}) {
  const [posture, setPosture] = useState<RewardPosture>("aggressive");
  const [bill, setBill] = useState(700);
  const [selected, setSelected] = useState<Set<RewardSegmentKey>>(new Set());

  const toggle = (k: RewardSegmentKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Standard always qualifies; add the selected rungs (kept in ladder order).
  const qualifying = SEGMENTS.filter(
    (s) => s.key === "standard" || selected.has(s.key),
  );
  const rungs = qualifying.map((s) => ({
    seg: s,
    rate: config.grid[s.key][posture],
  }));
  // Best-of: the single highest rate. On a tie the higher-ranked rung wins.
  const best = rungs.reduce((a, b) => (b.rate >= a.rate ? b : a), rungs[0]);
  const cappedBase = Math.min(bill, config.cap);
  const discount = Math.round((best.rate / 100) * cappedBase);
  const finalBill = Math.max(0, bill - discount);
  const postureLabel =
    POSTURES.find((p) => p.key === posture)?.label ?? posture;

  return (
    <div className="space-y-6">
      {loadError && <ErrorNote message={loadError} />}

      <SectionCard
        icon={<Gift className="text-secondary h-4 w-4" />}
        title="The visit"
        subtitle="Model one guest's bill. Pick the posture the place runs, the rungs this guest qualifies for, and the bill — the grid decides the discount."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs font-medium">
              Place posture
            </span>
            <select
              className={inputCls}
              value={posture}
              onChange={(e) => setPosture(e.target.value as RewardPosture)}
            >
              {POSTURES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs font-medium">
              Bill (MX$)
            </span>
            <input
              type="number"
              min={0}
              className={inputCls + " tabular-nums"}
              value={bill}
              onChange={(e) =>
                setBill(Math.max(0, Math.round(Number(e.target.value) || 0)))
              }
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
            Rungs this guest qualifies for
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
              <span aria-hidden>🙂</span> Standard
              <span className="text-muted-foreground/60">· base</span>
            </span>
            {OPTIONAL.map((s) => {
              const on = selected.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggle(s.key)}
                  aria-pressed={on}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (on
                      ? "border-secondary/30 bg-secondary/10 text-secondary"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  <span aria-hidden>{s.emoji}</span>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Trophy className="text-secondary h-4 w-4" />}
        title="Best-of result"
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Discount rate"
            value={best.rate > 0 ? `${best.rate}%` : "Off"}
            sub={
              best.rate > 0
                ? `${best.seg.emoji} ${best.seg.name}`
                : "no qualifying rung pays"
            }
          />
          <Stat
            label="Guest saves"
            value={`MX$${discount}`}
            sub={`${best.rate}% of the first MX$${cappedBase}`}
          />
          <Stat
            label="Guest pays"
            value={`MX$${finalBill}`}
            sub={`on a MX$${bill} bill`}
          />
        </div>

        <div className="mt-5">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
            Why — every qualifying rung at {postureLabel}
          </p>
          <ul className="mt-2 space-y-1">
            {rungs
              .slice()
              .sort((a, b) => b.rate - a.rate)
              .map(({ seg, rate }) => {
                const winner = seg.key === best.seg.key && best.rate > 0;
                return (
                  <li
                    key={seg.key}
                    className={
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm " +
                      (winner ? "bg-secondary/10" : "")
                    }
                  >
                    <span aria-hidden>{seg.emoji}</span>
                    <span
                      className={
                        "min-w-0 flex-1 truncate " +
                        (winner ? "text-secondary font-semibold" : "")
                      }
                    >
                      {seg.name}
                    </span>
                    {winner && (
                      <Trophy className="text-secondary h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="shrink-0 tabular-nums">
                      {rate > 0 ? `${rate}%` : "—"}
                    </span>
                  </li>
                );
              })}
          </ul>
          <p className="text-muted-foreground/80 mt-2 text-[11px]">
            The guest is paid the single highest rung — never a sum. The universal
            cap ({`MX$${config.cap}`}) bounds the discountable slice of the bill.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
