"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_SCORES_CONFIG,
  fitScore,
  laneFormula,
  laneScore,
  LANES,
  MATCH_MAX,
  quantizeH,
  waitScore,
  whenScore,
  whereScore,
  type Lane,
  type ScoresConfig,
} from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import type { SamplePlace } from "./actions";

// The worked example on Scoring Config: real places, four lanes at both match
// tiers, hyperparameters on top. Everything derives from @/lib/business/scores
// — no knob is restated here.
//
// An admin view has no consumer and no query, so RM / LM / distance / hours
// are operator controls, not data. Posture is too: `admin-web-search-places`
// doesn't return the rate columns, so it seeds round-robin across the four
// presets rather than pretending to read a real one. What IS real is the
// roster — a random sample of the live catalog every load.
//
// Each lane board draws TWO bars per place: the ghost is the Fast score (RM —
// the screen order), the solid is the Slow score (LM — the final order), rows
// sorted by Slow. The gap between ghost and solid is literally what the LLM
// judge changed about the RAG estimate.

const PROMO_BY_ID: Record<string, number> = { zero: 0, conservative: 1, aggressive: 2, dominant: 3 };

type Row = {
  id: string;
  name: string;
  sub: string;
  /** Fast match — RAG cosine estimate. */
  rm: number;
  /** Slow match — LLM judge verdict. */
  lm: number;
  km: number;
  opensIn: number;
  openFor: number;
  posture: string;
};

/** Spread the sample across the input space so the matrix shows contrast. */
function seedRows(places: SamplePlace[]): Row[] {
  const KM = [1, 4, 2, 25, 8, 0.5, 12, 3, 18, 6];
  const OPENS = [0, 0, 0, 0, 2.5, 0, 1, 0, 3.5, 0];
  const OPEN_FOR = [6, 6, 0.5, 6, 3, 2, 6, 1, 4, 6];
  const RM = [85, 80, 55, 85, 40, 70, 60, 75, 45, 65];
  // LM deviates from RM on purpose — a rerank that never reorders shows nothing.
  const LM_DELTA = [8, -14, 20, -6, 12, -16, 6, -10, 15, -4];
  const POSTURES = STRATEGIES.map((s) => s.id);

  return places.map((p, i) => {
    const bits = [p.categoryLabel, p.googleStars != null ? `${p.googleStars}★` : null]
      .filter(Boolean)
      .join(" · ");
    const rm = RM[i % RM.length];
    return {
      id: p.id,
      name: p.name,
      sub: bits || "—",
      rm,
      lm: Math.max(0, Math.min(MATCH_MAX, rm + LM_DELTA[i % LM_DELTA.length])),
      km: KM[i % KM.length],
      opensIn: OPENS[i % OPENS.length],
      openFor: OPEN_FOR[i % OPEN_FOR.length],
      posture: POSTURES[i % POSTURES.length],
    };
  });
}

export function Simulator({ places }: { places: SamplePlace[] }) {
  const [cfg, setCfg] = useState<ScoresConfig>(DEFAULT_SCORES_CONFIG);
  const [rows, setRows] = useState<Row[]>(() => seedRows(places));

  const set = <K extends keyof ScoresConfig>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const computed = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        where: whereScore(r.km, cfg),
        wait: waitScore(r.opensIn, cfg),
        fit: fitScore(r.openFor, cfg),
        when: whenScore(r.opensIn, r.openFor, cfg),
        promos: PROMO_BY_ID[r.posture] ?? 0,
      })),
    [rows, cfg],
  );

  // Fast (RM) is the ghost — the screen order. Slow (LM) is the solid — the
  // final order. Rows sort by Slow.
  const ranked = (lane: Lane) =>
    computed
      .map((c) => {
        const base = { where: c.where, when: c.when, promos: c.promos };
        return {
          name: c.row.name,
          fast: laneScore(lane, { ...base, match: c.row.rm }),
          slow: laneScore(lane, { ...base, match: c.row.lm }),
        };
      })
      .sort((a, b) => b.slow - a.slow);

  return (
    <div className="mt-5 flex flex-col gap-5">
      {/* ── Hyperparameters ─────────────────────────────────────── */}
      <div>
        <GroupHead>Hyperparameters — every one is a belief, not a fitted value</GroupHead>
        <div className="border-border/60 mt-2 grid gap-x-6 gap-y-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Slider
            label="Half-pull radius · d₀"
            value={`${cfg.distanceHalfKm.toFixed(1)} km`}
            min={1}
            max={20}
            step={0.5}
            v={cfg.distanceHalfKm}
            onChange={(v) => set("distanceHalfKm", v)}
            hint={`20 km lands at ${whereScore(20, cfg).toFixed(2)}`}
          />
          <Slider
            label="Wait half-life · a½"
            value={`${cfg.waitHalfH.toFixed(1)} h`}
            min={0.5}
            max={4}
            step={0.5}
            v={cfg.waitHalfH}
            onChange={(v) => set("waitHalfH", v)}
            hint={`a 2 h wait lands at ${waitScore(2, cfg).toFixed(2)}`}
          />
          <Slider
            label="Cliff sharpness · k"
            value={cfg.waitExp.toFixed(2)}
            min={1}
            max={5}
            step={0.25}
            v={cfg.waitExp}
            onChange={(v) => set("waitExp", v)}
            hint={
              cfg.waitExp <= 1
                ? "no plateau — every block costs"
                : `30 min → ${waitScore(0.5, cfg).toFixed(2)} · plateau then cliff`
            }
          />
          <Slider
            label="Session length · L"
            value={`${cfg.sessionH.toFixed(1)} h`}
            min={0.5}
            max={4}
            step={0.5}
            v={cfg.sessionH}
            onChange={(v) => set("sessionH", v)}
            hint={`30 min left → fit ${fitScore(0.5, cfg).toFixed(2)}`}
          />
        </div>
      </div>

      {/* ── The 2×2, both tiers per board ───────────────────────── */}
      <div>
        <GroupHead>Four lanes · ghost = Fast (RM) · solid = Slow (LM)</GroupHead>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {LANES.map((lane) => (
            <LaneBoard key={lane.id} lane={lane} rows={ranked(lane)} />
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
          Rows sort by Slow — the final order. The ghost bar is where Fast put
          the place; the gap is what the LLM judge changed. Swipe screens Fast
          then sorts Slow · Map ships Fast · Memo sorts Slow.
        </p>
      </div>

      {/* ── The bench ───────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <GroupHead>Examples · {places.length} random places from the catalog</GroupHead>
          <p className="text-muted-foreground font-mono text-[11px]">
            time resolves to 30-min blocks
          </p>
        </div>
        <div className="border-border/60 mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                {["Place", "RM · fast", "LM · slow", "Distance", "Opens in", "Open for", "Posture", "where", "when"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={
                        "text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-[10px] font-semibold tracking-[0.1em] uppercase " +
                        (i >= 7 ? "text-right" : "text-left")
                      }
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {computed.map((c, i) => (
                <tr key={c.row.id} className="border-border/60 border-b last:border-0">
                  <td className="max-w-[180px] px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold">{c.row.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-[10px]">
                      {c.row.sub}
                    </p>
                  </td>
                  <Cell>
                    <Mini
                      min={0}
                      max={MATCH_MAX}
                      step={1}
                      v={c.row.rm}
                      onChange={(v) => setRow(i, { rm: v })}
                      label={`RM for ${c.row.name}`}
                      read={String(c.row.rm)}
                    />
                  </Cell>
                  <Cell>
                    <Mini
                      min={0}
                      max={MATCH_MAX}
                      step={1}
                      v={c.row.lm}
                      onChange={(v) => setRow(i, { lm: v })}
                      label={`LM for ${c.row.name}`}
                      read={String(c.row.lm)}
                      warn={Math.abs(c.row.lm - c.row.rm) >= 15}
                    />
                  </Cell>
                  <Cell>
                    <Mini
                      min={0}
                      max={40}
                      step={0.5}
                      v={c.row.km}
                      onChange={(v) => setRow(i, { km: v })}
                      label={`Distance to ${c.row.name}`}
                      read={`${c.row.km} km`}
                    />
                  </Cell>
                  <Cell>
                    <Mini
                      min={0}
                      max={6}
                      step={0.5}
                      v={c.row.opensIn}
                      onChange={(v) => setRow(i, { opensIn: v })}
                      label={`Opens in, for ${c.row.name}`}
                      read={c.row.opensIn === 0 ? "open now" : `+${quantizeH(c.row.opensIn)} h`}
                      warn={c.row.opensIn > 0}
                    />
                  </Cell>
                  <Cell>
                    <Mini
                      min={0}
                      max={6}
                      step={0.5}
                      v={c.row.openFor}
                      onChange={(v) => setRow(i, { openFor: v })}
                      label={`Open for, at ${c.row.name}`}
                      read={c.row.openFor === 0 ? "closed" : `${quantizeH(c.row.openFor)} h`}
                      warn={c.fit < 1}
                    />
                  </Cell>
                  <td className="px-3 py-2.5">
                    <select
                      value={c.row.posture}
                      onChange={(e) => setRow(i, { posture: e.target.value })}
                      aria-label={`Posture for ${c.row.name}`}
                      className="border-border/70 bg-card w-full rounded-lg border px-2 py-1.5 font-mono text-[11px]"
                    >
                      {STRATEGIES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {PROMO_BY_ID[s.id]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] tabular-nums">
                    {c.where.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold tabular-nums">
                    {c.when.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="w-[96px] px-3 py-2.5">{children}</td>;
}

function Slider({
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

function Mini({
  min,
  max,
  step,
  v,
  onChange,
  label,
  read,
  warn,
}: {
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (v: number) => void;
  label: string;
  read: string;
  warn?: boolean;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-primary w-full"
      />
      <p
        className={
          "mt-1 text-center font-mono text-[10px] tabular-nums " +
          (warn ? "text-amber-700" : "text-muted-foreground")
        }
      >
        {read}
      </p>
    </>
  );
}

function LaneBoard({
  lane,
  rows,
}: {
  lane: Lane;
  rows: { name: string; fast: number; slow: number }[];
}) {
  const organic = lane.lane === "organic";
  const tint = organic ? "border-sky-500/30 bg-sky-500/[0.04]" : "border-pink-500/30 bg-pink-500/[0.04]";
  const head = organic ? "text-sky-700" : "text-pink-700";
  const bar = organic ? "bg-sky-400" : "bg-pink-400";
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / lane.max) * 100))}%`;
  return (
    <div className={"rounded-xl border p-3.5 " + tint}>
      <p className={"text-[10px] font-bold tracking-[0.14em] uppercase " + head}>
        {organic ? "Organic" : "Inorganic"} · {lane.mode}
      </p>
      <p className="text-muted-foreground mt-0.5 mb-2.5 font-mono text-[10px]">
        {laneFormula(lane, "RM")} ghost → {laneFormula(lane, "LM")} solid · 0–{lane.max}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r, k) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="text-muted-foreground w-3 shrink-0 font-mono text-[10px] tabular-nums">
              {k + 1}
            </span>
            <span className="w-[104px] shrink-0 truncate text-[11px]" title={r.name}>
              {r.name}
            </span>
            <span className="bg-card relative h-1.5 flex-1 overflow-hidden rounded-full">
              <span
                className="bg-muted-foreground/25 absolute inset-y-0 left-0 rounded-full transition-[width]"
                style={{ width: pct(r.fast) }}
              />
              <span
                className={"absolute inset-y-0 left-0 rounded-full transition-[width] " + bar}
                style={{ width: pct(r.slow) }}
              />
            </span>
            <span className="text-muted-foreground w-8 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {r.slow < 10 ? r.slow.toFixed(1) : Math.round(r.slow)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
