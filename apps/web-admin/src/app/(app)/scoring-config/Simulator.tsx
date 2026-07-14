"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ENGINE_MIX,
  DEFAULT_RETRIEVAL,
  DEFAULT_SCORES_CONFIG,
  ENGINE_POLICIES,
  fitScore,
  laneScore,
  LANES,
  MATCH_MAX,
  waitScore,
  whenScore,
  whereScore,
  type EngineId,
  type Lane,
  type LaneId,
  type ScoresConfig,
} from "@/lib/business/scores";
import {
  buildConsumerProfile,
  generateIntent,
  haversineKm,
  lmCip,
  openWindow,
  rmCip,
  type ConsumerProfile,
  type Intent,
  type SampleConsumer,
  type SamplePlace,
} from "@/lib/business/cip";
import { PROMO_SCORE_BY_STRATEGY, STRATEGIES, strategyForPlace, type StrategyId } from "@/lib/business/strategies";

// Scoring Config = hyperparameters on top, functional playground below.
//
// The playground runs the full data flow per engine: REAL consumer (DB) +
// SYNTHETIC intent (generator) + REAL place (DB, incl. live promo rates, geo
// and hours) → RM-CIP / LM-CIP / WW / P → lane scores → the engine's Fast
// screen (top shortlist-n by the fast blend) → Slow sort → ONE ranked list.
// No decorative UI: each engine outputs just its sorted list with the total.
//
// Consumer-data and intent-data are the SAME side (merged for matching);
// consumer is the barely-mutable half, intent the per-query half. Memo
// generates flexible prompts; Swipe/Map have a fixed prompt structure where
// only the data slots change. RM/LM are deterministic heuristics — stand-ins
// until embeddings + the judge EF exist (labeled on the page).

type EngineRun = { profile: ConsumerProfile; intent: Intent };

type ScoredRow = {
  place: SamplePlace;
  rm: number;
  lm: number;
  where: number;
  when: number;
  km: number | null;
  hoursUnknown: boolean;
  promos: number;
  fastTotal: number;
  slowTotal: number;
};

export function Simulator({
  consumers,
  places,
}: {
  consumers: SampleConsumer[];
  places: SamplePlace[];
}) {
  const router = useRouter();

  // ── Hyperparameter state ─────────────────────────────────────────
  const [cfg, setCfg] = useState<ScoresConfig>(DEFAULT_SCORES_CONFIG);
  const [mix, setMix] = useState(DEFAULT_ENGINE_MIX);
  const [retrieval, setRetrieval] = useState(DEFAULT_RETRIEVAL);
  const [promoVals, setPromoVals] = useState<Record<StrategyId, number>>({
    ...PROMO_SCORE_BY_STRATEGY,
  });

  // ── Playground state — one generated run per engine ──────────────
  const [runs, setRuns] = useState<Partial<Record<EngineId, EngineRun>>>({});
  const [seed, setSeed] = useState(1);

  const set = <K extends keyof ScoresConfig>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setMixCell = (e: EngineId, l: LaneId, v: number) =>
    setMix((m) => ({ ...m, [e]: { ...m[e], [l]: Math.max(0, Math.min(100, v)) } }));

  // Deterministic per click — the seed counter drives consumer pick and
  // intent generation, so a run is reproducible (and the purity lint stays
  // happy: no Math.random in render scope).
  const generate = (engine: EngineId) => {
    const s = seed;
    setSeed((x) => x + 1);
    const offset = ENGINE_POLICIES.findIndex((e) => e.id === engine);
    const consumer =
      consumers.length > 0 ? consumers[(s * 7 + offset) % consumers.length] : null;
    const profile = buildConsumerProfile(consumer);
    const intent = generateIntent(engine, profile, places, s * 13 + offset * 5);
    setRuns((r) => ({ ...r, [engine]: { profile, intent } }));
  };

  // Boards/lists meter against ceilings that follow the editable P values.
  const maxPromo = Math.max(1, ...Object.values(promoVals));
  const dynMax = (lane: Lane) => (lane.lane === "inorganic" ? MATCH_MAX * maxPromo : MATCH_MAX);

  // Blend a place's four lane scores by the engine's mix → 0–100.
  const blend = (engine: EngineId, laneVals: Record<LaneId, number>) =>
    LANES.reduce(
      (s, lane) => s + ((mix[engine][lane.id] ?? 0) / 100) * (laneVals[lane.id] / dynMax(lane)) * 100,
      0,
    );

  // The full pipeline for one engine run — recomputed live as knobs move.
  const results = useMemo(() => {
    const out: Partial<Record<EngineId, { kept: ScoredRow[]; screened: number }>> = {};
    for (const e of ENGINE_POLICIES) {
      const run = runs[e.id];
      if (!run) continue;
      const ci = [...run.profile.tasteTokens, ...run.intent.tokens];
      const cid = run.profile.consumer?.id ?? "synthetic";

      const rows: ScoredRow[] = places.map((p) => {
        const rm = rmCip(ci, p);
        const lm = lmCip(ci, p, cid);
        const km =
          run.intent.lat != null && run.intent.lng != null && p.lat != null && p.lng != null
            ? haversineKm(run.intent.lat, run.intent.lng, Number(p.lat), Number(p.lng))
            : null;
        const win = openWindow(p.hours, run.intent.day, run.intent.hour);
        const where = whereScore(km, cfg);
        const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);
        const promos =
          promoVals[
            strategyForPlace({
              welcome_free_rate: p.welcome_free_rate,
              welcome_premium_rate: p.welcome_premium_rate,
              free_rate: p.free_rate,
              premium_rate: p.premium_rate,
            }) as StrategyId
          ] ?? 0;

        const laneVals = (match: number) =>
          Object.fromEntries(
            LANES.map((lane) => [lane.id, laneScore(lane, { match, where, when, promos })]),
          ) as Record<LaneId, number>;

        return {
          place: p,
          rm,
          lm,
          where,
          when,
          km,
          hoursUnknown: win.unknown,
          promos,
          fastTotal: blend(e.id, laneVals(rm)),
          slowTotal: blend(e.id, laneVals(lm)),
        };
      });

      // Fast screens (top shortlist-n by the fast blend) → Slow sorts.
      const screened = [...rows].sort((a, b) => b.fastTotal - a.fastTotal);
      const kept = screened
        .slice(0, retrieval.shortlistN)
        .sort((a, b) => b.slowTotal - a.slowTotal);
      out[e.id] = { kept, screened: Math.max(0, rows.length - retrieval.shortlistN) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, places, cfg, mix, promoVals, retrieval]);

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
                      <span className="text-muted-foreground/70 ml-2 text-[10px]">intent: {e.intent}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          ON organic·now · OF organic·future · IN inorganic·now · IF inorganic·future — the share of
          each engine&apos;s results every lane supplies. Rows should sum to 100.
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
              <Chip label="RM-CIP here" value="token overlap" hint="stand-in until embeddings exist" />
            </div>
          </div>
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>LIPD · LLM intent-place data</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Shortlist n"
                value={String(retrieval.shortlistN)}
                min={1}
                max={50}
                step={1}
                v={retrieval.shortlistN}
                onChange={(v) => setRetrieval((r) => ({ ...r, shortlistN: v }))}
                hint="Fast keeps this many for the Slow sort"
              />
              <Chip label="LM-CIP here" value="RM + judgments" hint="stand-in until the judge EF exists" />
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
                <div key={s.id} className="bg-muted/60 border-border/60 rounded-xl border px-2 py-2.5 text-center">
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
              0 = not in the paid lane. Applied to each sampled place via its REAL rates.
            </p>
          </div>
        </div>
      </div>

      {/* ══ PLAYGROUND — three engines, just the lists ════════════ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GroupHead>
            Playground · {consumers.length} real consumer{consumers.length === 1 ? "" : "s"} ·{" "}
            {places.length} real places
          </GroupHead>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="border-border/70 hover:bg-muted rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]"
          >
            Resample from DB
          </button>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          Real consumer (DB) + synthetic intent (generator) + real place (DB: rates, geo, hours) →
          RM-CIP · LM-CIP · WW · P → Fast screens top {retrieval.shortlistN} → Slow sorts. Lists
          recompute live as hyperparameters move.
          {consumers.length === 0 ? " No consumers in the DB — runs use a labeled synthetic consumer." : ""}
        </p>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {ENGINE_POLICIES.map((e) => {
            const run = runs[e.id];
            const res = results[e.id];
            return (
              <div key={e.id} className="border-border/60 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold">{e.engine}</p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                      {e.id === "memo" ? "flexible intent · " : "fixed prompt structure · "}
                      {e.policy}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => generate(e.id)}
                    className="bg-pink-gradient shadow-save rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
                  >
                    Generate
                  </button>
                </div>

                {!run || !res ? (
                  <p className="text-muted-foreground mt-4 text-[12px]">
                    Generate to run: pick a consumer, synthesize an intent, score every place.
                  </p>
                ) : (
                  <>
                    {/* The C and the I of CIP */}
                    <div className="bg-muted/50 border-border/60 mt-3 rounded-lg border px-3 py-2">
                      <p className="font-mono text-[10.5px]">
                        <span className="text-muted-foreground">C · </span>
                        {run.profile.consumer?.label ?? "—"} · {run.profile.consumer?.class_key ?? "synthetic"}
                        {run.profile.synthetic ? (
                          <span className="text-amber-700"> · taste SYNTH</span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {" "}
                          [{run.profile.tasteTokens.slice(0, 5).join(", ")}]
                        </span>
                      </p>
                      <p className="mt-1 font-mono text-[10.5px]">
                        <span className="text-muted-foreground">I · </span>
                        {run.intent.text}
                      </p>
                    </div>

                    {/* Just the list */}
                    <div className="mt-2.5 flex flex-col">
                      {res.kept.map((r, k) => (
                        <div
                          key={r.place.id}
                          className="border-border/40 flex items-baseline gap-2 border-b py-1.5 last:border-0"
                        >
                          <span className="text-muted-foreground w-4 shrink-0 font-mono text-[11px] tabular-nums">
                            {k + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" title={r.place.name}>
                            {r.place.name}
                          </span>
                          <span className="font-mono text-[13px] font-semibold tabular-nums">
                            {r.slowTotal.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-muted-foreground mt-1.5 font-mono text-[9.5px] leading-relaxed">
                      {res.kept
                        .map(
                          (r, k) =>
                            `${k + 1}· LM ${r.lm} RM ${r.rm} WW ${(r.where * r.when).toFixed(2)}${r.hoursUnknown ? "?" : ""} P ${r.promos}${r.km != null ? ` ${Math.round(r.km)}km` : ""}`,
                        )
                        .join("   ")}
                    </p>
                    {res.screened > 0 ? (
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        Fast screened out {res.screened} below the top {retrieval.shortlistN}.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const LANE_SHORT: Record<LaneId, string> = {
  "organic-now": "ON",
  "organic-future": "OF",
  "inorganic-now": "IN",
  "inorganic-future": "IF",
};

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
