"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ENGINE_MIX,
  DEFAULT_RETRIEVAL,
  DEFAULT_SCORES_CONFIG,
  ENGINE_POLICIES,
  fitScore,
  laneFormula,
  laneScore,
  LANES,
  MATCH_MAX,
  quantizeH,
  waitScore,
  whenScore,
  whereScore,
  type EngineId,
  type Lane,
  type LaneId,
  type ScoresConfig,
} from "@/lib/business/scores";
import { PROMO_SCORE_BY_STRATEGY, STRATEGIES, type StrategyId } from "@/lib/business/strategies";
import type { SamplePlace } from "./actions";

// Scoring Config = hyperparameters on top, playground below.
//
// Hyperparameters, in Pato's grouping: the ENGINE LANE MIX (what share of each
// engine's results every lane supplies — the interleave knob), then RIPD (RAG
// intent-place data), LIPD (LLM intent-place data), WW (where · when) and P
// (promos). Engine tier policies are FACTS of the architecture, shown but not
// knobs — every engine screens Fast, sorts Slow.
//
// The playground samples real places (server-side random sample; the page
// keys this component by the sample so Resample remounts it), and shows: the
// four lane boards (ghost = Fast/RIPM order, solid = Slow/LIPM order), the
// per-engine blended top lists driven by the mix, and the bench of per-place
// inputs.
//
// An admin view has no consumer and no query, so RIPM/LIPM/distance/hours are
// operator controls, not data. Posture seeds round-robin (the sample EF
// doesn't return rate columns). Everything numeric derives from
// @/lib/business/scores — no knob is restated here.

type Row = {
  id: string;
  name: string;
  sub: string;
  /** Fast match — RIPM, the RAG cosine estimate. */
  ripm: number;
  /** Slow match — LIPM, the LLM judge verdict. */
  lipm: number;
  km: number;
  opensIn: number;
  openFor: number;
  posture: StrategyId;
};

/** Spread the sample across the input space so the boards show contrast. */
function seedRows(places: SamplePlace[]): Row[] {
  const KM = [1, 4, 2, 25, 8, 0.5, 12, 3, 18, 6];
  const OPENS = [0, 0, 0, 0, 2.5, 0, 1, 0, 3.5, 0];
  const OPEN_FOR = [6, 6, 0.5, 6, 3, 2, 6, 1, 4, 6];
  const RIPM_SEED = [85, 80, 55, 85, 40, 70, 60, 75, 45, 65];
  // LIPM deviates from RIPM on purpose — a rerank that never reorders shows nothing.
  const LIPM_DELTA = [8, -14, 20, -6, 12, -16, 6, -10, 15, -4];
  const POSTURES = STRATEGIES.map((s) => s.id);

  return places.map((p, i) => {
    const bits = [p.categoryLabel, p.googleStars != null ? `${p.googleStars}★` : null]
      .filter(Boolean)
      .join(" · ");
    const ripm = RIPM_SEED[i % RIPM_SEED.length];
    return {
      id: p.id,
      name: p.name,
      sub: bits || "—",
      ripm,
      lipm: Math.max(0, Math.min(MATCH_MAX, ripm + LIPM_DELTA[i % LIPM_DELTA.length])),
      km: KM[i % KM.length],
      opensIn: OPENS[i % OPENS.length],
      openFor: OPEN_FOR[i % OPEN_FOR.length],
      posture: POSTURES[i % POSTURES.length],
    };
  });
}

const LANE_SHORT: Record<LaneId, string> = {
  "organic-now": "ON",
  "organic-future": "OF",
  "inorganic-now": "IN",
  "inorganic-future": "IF",
};

const LANE_BADGE: Record<LaneId, string> = {
  "organic-now": "bg-sky-500/15 text-sky-700",
  "organic-future": "bg-sky-500/[0.07] text-sky-600",
  "inorganic-now": "bg-pink-500/15 text-pink-700",
  "inorganic-future": "bg-pink-500/[0.07] text-pink-600",
};

export function Simulator({ places }: { places: SamplePlace[] }) {
  const router = useRouter();

  // ── Hyperparameter state ─────────────────────────────────────────
  const [cfg, setCfg] = useState<ScoresConfig>(DEFAULT_SCORES_CONFIG);
  const [mix, setMix] = useState(DEFAULT_ENGINE_MIX);
  const [retrieval, setRetrieval] = useState(DEFAULT_RETRIEVAL);
  const [promoVals, setPromoVals] = useState<Record<StrategyId, number>>({
    ...PROMO_SCORE_BY_STRATEGY,
  });

  // ── Playground state ─────────────────────────────────────────────
  const [rows, setRows] = useState<Row[]>(() => seedRows(places));
  const [nSamples, setNSamples] = useState(places.length);

  const set = <K extends keyof ScoresConfig>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setMixCell = (e: EngineId, l: LaneId, v: number) =>
    setMix((m) => ({ ...m, [e]: { ...m[e], [l]: Math.max(0, Math.min(100, v)) } }));

  const active = useMemo(() => rows.slice(0, nSamples), [rows, nSamples]);

  const computed = useMemo(
    () =>
      active.map((r) => ({
        row: r,
        where: whereScore(r.km, cfg),
        wait: waitScore(r.opensIn, cfg),
        fit: fitScore(r.openFor, cfg),
        when: whenScore(r.opensIn, r.openFor, cfg),
        promos: promoVals[r.posture] ?? 0,
      })),
    [active, cfg, promoVals],
  );

  // Boards meter against a ceiling that follows the editable P values.
  const maxPromo = Math.max(1, ...Object.values(promoVals));
  const dynMax = (lane: Lane) =>
    lane.lane === "inorganic" ? MATCH_MAX * maxPromo : MATCH_MAX;

  // Fast (RIPM) is the ghost — the screen order. Slow (LIPM) is the solid —
  // the final order. Rows sort by Slow.
  const ranked = useMemo(() => {
    const out = {} as Record<LaneId, { name: string; fast: number; slow: number }[]>;
    for (const lane of LANES) {
      out[lane.id] = computed
        .map((c) => {
          const base = { where: c.where, when: c.when, promos: c.promos };
          return {
            name: c.row.name,
            fast: laneScore(lane, { ...base, match: c.row.ripm }),
            slow: laneScore(lane, { ...base, match: c.row.lipm }),
          };
        })
        .sort((a, b) => b.slow - a.slow);
    }
    return out;
  }, [computed]);

  // ── Engine preview — the mix made real ───────────────────────────
  // Slots per lane via largest remainder, filled from each lane's Slow
  // ranking, deduped across lanes (a place appears once, tagged by the lane
  // that claimed it), leftovers refilled in mix order.
  const SLOTS = 6;
  const enginePreview = (e: EngineId) => {
    const m = mix[e];
    const exact = LANES.map((l) => ({ id: l.id, x: ((m[l.id] ?? 0) * SLOTS) / 100 }));
    const q = Object.fromEntries(exact.map((en) => [en.id, Math.floor(en.x)])) as Record<
      LaneId,
      number
    >;
    let used = exact.reduce((s, en) => s + Math.floor(en.x), 0);
    for (const en of [...exact].sort((a, b) => (b.x % 1) - (a.x % 1))) {
      if (used >= SLOTS) break;
      q[en.id]++;
      used++;
    }
    const laneOrder = [...LANES].sort((a, b) => (m[b.id] ?? 0) - (m[a.id] ?? 0));
    const taken = new Set<string>();
    const out: { name: string; lane: LaneId; v: number }[] = [];
    const pull = (laneId: LaneId, count: number) => {
      for (const r of ranked[laneId]) {
        if (out.length >= SLOTS || count <= 0) return;
        if (taken.has(r.name) || r.slow <= 0) continue;
        taken.add(r.name);
        out.push({ name: r.name, lane: laneId, v: r.slow });
        count--;
      }
    };
    for (const lane of laneOrder) pull(lane.id, q[lane.id]);
    for (const lane of laneOrder) if (out.length < SLOTS) pull(lane.id, SLOTS - out.length);
    return out;
  };

  const mixSum = (e: EngineId) => LANES.reduce((s, l) => s + (mix[e][l.id] ?? 0), 0);

  return (
    <div className="mt-5 flex flex-col gap-6">
      {/* ══ HYPERPARAMETERS ═══════════════════════════════════════ */}
      <div>
        <GroupHead>Hyperparameters — every one is a belief, not a fitted value</GroupHead>

        {/* Engine lane mix */}
        <div className="border-border/60 mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr>
                <th className="text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-left text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Engine lane mix
                </th>
                {LANES.map((l) => (
                  <th
                    key={l.id}
                    className="text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-right text-[10px] font-semibold tracking-[0.1em] uppercase"
                  >
                    {LANE_SHORT[l.id]}
                  </th>
                ))}
                <th className="text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-right text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Σ
                </th>
                <th className="text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-left text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Tier policy · not a knob
                </th>
              </tr>
            </thead>
            <tbody>
              {ENGINE_POLICIES.map((e) => {
                const sum = mixSum(e.id);
                return (
                  <tr key={e.id} className="border-border/60 border-b last:border-0">
                    <td className="px-3 py-2.5 text-[13px] font-semibold">{e.engine}</td>
                    {LANES.map((l) => (
                      <td key={l.id} className="px-3 py-2.5 text-right whitespace-nowrap">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={mix[e.id][l.id]}
                          onChange={(ev) => setMixCell(e.id, l.id, Number(ev.target.value))}
                          aria-label={`${e.engine} share from ${l.lane} ${l.mode}`}
                          className="border-border/70 bg-card w-14 rounded-lg border px-1.5 py-1 text-right font-mono text-[12px] tabular-nums"
                        />
                        <span className="text-muted-foreground ml-0.5 font-mono text-[10px]">%</span>
                      </td>
                    ))}
                    <td
                      className={
                        "px-3 py-2.5 text-right font-mono text-[12px] font-semibold tabular-nums " +
                        (sum === 100 ? "text-muted-foreground" : "text-amber-700")
                      }
                    >
                      {sum}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-muted-foreground font-mono text-[11px]">{e.policy}</span>
                      <span className="text-muted-foreground/70 ml-2 text-[10px]">
                        intent: {e.intent}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          ON organic·now · OF organic·future · IN inorganic·now · IF
          inorganic·future — the share of each engine&apos;s results every lane
          supplies. Rows should sum to 100.
        </p>

        {/* RIPD · LIPD · WW · P */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>RIPD · RAG intent-place data</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Recall top-K"
                value={String(retrieval.recallTopK)}
                min={10}
                max={200}
                step={10}
                v={retrieval.recallTopK}
                onChange={(v) => setRetrieval((r) => ({ ...r, recallTopK: v }))}
                hint="places pgvector returns per query"
              />
              <Chip label="Embedding" value="1,536 dims" hint="profile text → vector" />
            </div>
          </div>
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>LIPD · LLM intent-place data</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Shortlist n"
                value={String(retrieval.shortlistN)}
                min={5}
                max={50}
                step={5}
                v={retrieval.shortlistN}
                onChange={(v) => setRetrieval((r) => ({ ...r, shortlistN: v }))}
                hint="recalled places the judge re-scores"
              />
              <Chip label="Judge" value="1 call" hint="per query, on the shortlist" />
            </div>
          </div>
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>WW · where, when</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
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
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>P · promos</SubHead>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {STRATEGIES.map((s) => (
                <div
                  key={s.id}
                  className="bg-muted/60 border-border/60 rounded-xl border px-2 py-2.5 text-center"
                >
                  <p className="text-muted-foreground text-[11px]">{s.name}</p>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    step={1}
                    value={promoVals[s.id]}
                    onChange={(e) =>
                      setPromoVals((p) => ({
                        ...p,
                        [s.id]: Math.max(0, Math.min(9, Number(e.target.value))),
                      }))
                    }
                    aria-label={`Promo value for ${s.name}`}
                    className="border-border/70 bg-card font-display mt-1 w-14 rounded-lg border px-1 py-0.5 text-center text-lg font-semibold tabular-nums"
                  />
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
              0 = not in the paid lane. Linear by default — the paid lane only
              ranks against itself, so only the spread matters.
            </p>
          </div>
        </div>
      </div>

      {/* ══ PLAYGROUND ════════════════════════════════════════════ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GroupHead>Playground · {places.length} random places from the catalog</GroupHead>
          <div className="flex items-center gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-[12px]">
              samples
              <input
                type="range"
                min={1}
                max={places.length}
                step={1}
                value={nSamples}
                onChange={(e) => setNSamples(Number(e.target.value))}
                aria-label="Number of samples"
                className="accent-primary w-28"
              />
              <span className="font-mono text-[12px] font-semibold tabular-nums">{nSamples}</span>
            </label>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="border-border/70 hover:bg-muted rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]"
            >
              Resample
            </button>
          </div>
        </div>

        {/* The four lane boards */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {LANES.map((lane) => (
            <LaneBoard key={lane.id} lane={lane} max={dynMax(lane)} rows={ranked[lane.id]} />
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
          Ghost bar = Fast (RIPM) — the screen order. Solid = Slow (LIPM) — the
          final order; rows sort by it. The gap is what the LLM judge changed.
        </p>

        {/* Engines — the mix made real */}
        <div className="mt-5">
          <GroupHead>Engines · top {SLOTS} each, blended by the lane mix</GroupHead>
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {ENGINE_POLICIES.map((e) => (
              <div key={e.id} className="border-border/60 rounded-xl border p-3.5">
                <p className="text-[13px] font-semibold">{e.engine}</p>
                <p className="text-muted-foreground mb-2 font-mono text-[10px]">{e.policy}</p>
                <div className="flex flex-col gap-1">
                  {enginePreview(e.id).map((r, k) => (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-3 shrink-0 font-mono text-[10px] tabular-nums">
                        {k + 1}
                      </span>
                      <span
                        className={
                          "w-7 shrink-0 rounded px-1 text-center font-mono text-[9px] font-semibold " +
                          LANE_BADGE[r.lane]
                        }
                      >
                        {LANE_SHORT[r.lane]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px]" title={r.name}>
                        {r.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                        {Math.round(r.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The bench */}
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <GroupHead>Bench · per-place inputs</GroupHead>
            <p className="text-muted-foreground font-mono text-[11px]">
              time resolves to 30-min blocks
            </p>
          </div>
          <div className="border-border/60 mt-2 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr>
                  {["Place", "RIPM · fast", "LIPM · slow", "Distance", "Opens in", "Open for", "Posture", "where", "when"].map(
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
                        v={c.row.ripm}
                        onChange={(v) => setRow(i, { ripm: v })}
                        label={`RIPM for ${c.row.name}`}
                        read={String(c.row.ripm)}
                      />
                    </Cell>
                    <Cell>
                      <Mini
                        min={0}
                        max={MATCH_MAX}
                        step={1}
                        v={c.row.lipm}
                        onChange={(v) => setRow(i, { lipm: v })}
                        label={`LIPM for ${c.row.name}`}
                        read={String(c.row.lipm)}
                        warn={Math.abs(c.row.lipm - c.row.ripm) >= 15}
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
                        onChange={(e) => setRow(i, { posture: e.target.value as StrategyId })}
                        aria-label={`Posture for ${c.row.name}`}
                        className="border-border/70 bg-card w-full rounded-lg border px-2 py-1.5 font-mono text-[11px]"
                      >
                        {STRATEGIES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {promoVals[s.id]}
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

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/80 text-[12px] font-semibold tracking-tight">{children}</p>;
}

function Chip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-foreground/80 text-[13px] font-medium">{label}</p>
      <p className="mt-1 font-mono text-[13px] font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 font-mono text-[10px] leading-snug">{hint}</p>
    </div>
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
  max,
  rows,
}: {
  lane: Lane;
  max: number;
  rows: { name: string; fast: number; slow: number }[];
}) {
  const organic = lane.lane === "organic";
  const tint = organic
    ? "border-sky-500/30 bg-sky-500/[0.04]"
    : "border-pink-500/30 bg-pink-500/[0.04]";
  const head = organic ? "text-sky-700" : "text-pink-700";
  const bar = organic ? "bg-sky-400" : "bg-pink-400";
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className={"rounded-xl border p-3.5 " + tint}>
      <p className={"text-[10px] font-bold tracking-[0.14em] uppercase " + head}>
        {lane.lane} · {lane.mode}
      </p>
      <p className="text-muted-foreground mt-0.5 mb-2.5 font-mono text-[10px]">
        {laneFormula(lane, "RIPM")} ghost → {laneFormula(lane, "LIPM")} solid · 0–{max}
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
