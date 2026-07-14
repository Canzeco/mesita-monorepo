"use client";

import {
  DEFAULT_SCORES_CONFIG as M,
  ENGINE_POLICIES,
  fitScore,
  laneFormula,
  LANES,
  MATCH_MAX,
  MATCH_TIERS,
  TIME_BLOCK_H,
  waitScore,
  whereScore,
  type EngineId,
  type LaneId,
  type ScoresConfig,
} from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { Chip, GroupHead, LANE_SHORT, PanelCard, Slider, SubHead } from "../panel-ui";

// Params — every hyperparameter of the scoring model, nothing else. Values
// set here carry into the Playground tab live (shared provider in the
// layout). Every knob derives from @/lib/business/scores; none is restated.

export function HyperparamsPanel() {
  const { cfg, setCfg, mix, setMix, retrieval, setRetrieval, promoVals, setPromoVals } =
    useScoring();

  const set = <K extends keyof ScoresConfig>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setMixCell = (e: EngineId, l: LaneId, v: number) =>
    setMix((m) => ({ ...m, [e]: { ...m[e], [l]: Math.max(0, Math.min(100, v)) } }));
  const mixSum = (e: EngineId) => LANES.reduce((s, l) => s + (mix[e][l.id] ?? 0), 0);

  return (
    <PanelCard
      title="Params"
      subtitle="Four lanes × two match tiers. RIPM estimates, LIPM settles; zero match zeroes every lane — money can't buy irrelevance. Every knob is a belief, not a fitted value."
      pill="Draft — drives nothing yet"
    >
      <div className="mt-5 flex flex-col gap-5">
        {/* Engine lane mix */}
        <div>
          <GroupHead>Engine lane mix — the interleave knob</GroupHead>
          <div className="border-border/60 mt-2 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr>
                  <th className="text-muted-foreground border-border/60 border-b px-3 pt-3 pb-2 text-left text-[10px] font-semibold tracking-[0.1em] uppercase">
                    Engine
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
            ON organic·now · OF organic·future · IN inorganic·now · IF inorganic·future — the share
            of each engine&apos;s results every lane supplies. Rows should sum to 100.
          </p>
        </div>

        {/* RIPD · LIPD · WW · P */}
        <div className="grid gap-3 lg:grid-cols-2">
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
              <Chip label="RM-CIP today" value="token overlap" hint="stand-in until embeddings exist" />
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
              <Chip label="LM-CIP today" value="RM + judgments" hint="stand-in until the judge EF exists" />
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
              0 = not in the paid lane. Applied to each sampled place via its REAL rates in the
              Playground.
            </p>
          </div>
        </div>

        {/* Definitions footer */}
        <div className="text-muted-foreground border-border/60 flex flex-col gap-1 border-t pt-3 font-mono text-[11px] leading-relaxed">
          <p>
            lanes:{" "}
            {LANES.map((l) => `${l.lane} ${l.mode} = ${laneFormula(l, "RIPM")} | ${laneFormula(l, "LIPM")}`).join("  ·  ")}
          </p>
          <p>
            {MATCH_TIERS.map((t) => `${t.term} = ${t.detail}`).join("  ·  ")}
            {"  ·  both 0–"}
            {MATCH_MAX}
          </p>
          <p>
            WW = where × when · where = 1/(1+(km/d₀)^{M.distanceExp}) · wait = 1/(1+(h/a½)^k) · fit
            = min(1, h/L) · {TIME_BLOCK_H * 60}-min blocks
          </p>
          <p>
            intent/place data carry where/when as TEXT only — WW is the only numeric where/when,
            and it multiplies the match, never feeds it
          </p>
        </div>
      </div>
    </PanelCard>
  );
}
