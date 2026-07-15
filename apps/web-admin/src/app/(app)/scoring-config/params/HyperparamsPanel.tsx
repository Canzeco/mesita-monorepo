"use client";

import {
  ENGINE_POLICIES,
  fitScore,
  laneFormula,
  LANES,
  MATCH_MAX,
  MATCH_TIERS,
  PIPELINE_CONTEXT,
  waitScore,
  whereScore,
  type EngineId,
  type LaneId,
  type ScoresConfig,
} from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import {
  Chip,
  ContextCols,
  ContextConfigCols,
  GroupHead,
  LANE_SHORT,
  PanelCard,
  Slider,
  SubHead,
} from "../panel-ui";

// Scoring Pipeline — divide et impera: ONE BOX PER SUB-FUNCTION, each with
// its own knobs AND its data-access contract (which consumer / intent / place
// fields it reads — the PIPELINE_CONTEXT spec in @/lib/business/scores).
//
//   Engine lane mix   how the four lanes compose each engine's results
//   RIPM              RAG match score — text in, estimate out
//   LIPM              LLM match score — text in, verdict out
//   WWW               the moment: WHAT · WHERE · WHEN — the only numbers
//   P                 promo score — posture from the live rates
//
// Values set here drive the Playground live (shared provider) and persist to
// app_settings.scoring_config via the save bar at the bottom.

export function HyperparamsPanel() {
  const {
    cfg,
    setCfg,
    mix,
    setMix,
    retrieval,
    setRetrieval,
    promoVals,
    setPromoVals,
    context,
    toggleContext,
    ripmParams,
    setRipmParams,
    lipmParams,
    setLipmParams,
    dirty,
    saving,
    saveError,
    savedOk,
    save,
    resetToDefaults,
    revert,
  } = useScoring();

  const ripmSet = new Set(context.ripm);
  const lipmSet = new Set(context.lipm);

  const set = <K extends keyof ScoresConfig>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setMixCell = (e: EngineId, l: LaneId, v: number) =>
    setMix((m) => ({ ...m, [e]: { ...m[e], [l]: Math.max(0, Math.min(100, v)) } }));
  const mixSum = (e: EngineId) => LANES.reduce((s, l) => s + (mix[e][l.id] ?? 0), 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ Engine lane mix ══════════════════════════════════════════ */}
      <PanelCard
        title="Engine lane mix"
        subtitle="How the four lanes compose each engine's results — the interleave knob. Paid share is capped by trust-sensitivity; now share follows each surface's temporal intent."
        pill="Draft — drives nothing yet"
      >
        <div className="border-border/60 mt-4 overflow-x-auto rounded-xl border">
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
                      <span className="text-muted-foreground/70 ml-2 text-[10px]">intent: {e.intent}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          ON organic·now · OF organic·future · IN inorganic·now · IF inorganic·future. Rows should
          sum to 100.
        </p>
      </PanelCard>

      {/* ══ RIPM ═════════════════════════════════════════════════════ */}
      <PanelCard
        title="RIPM · RAG match score"
        subtitle="cosine(consumer+intent embedding, place embedding) — cheap, whole catalog. Reads TEXT only: address, hours and time appear as words, never as computed numbers. The context below is CONFIG — click a field to include or exclude it from the embedded documents; the Playground re-embeds and re-ranks from exactly this set."
        pill={`${context.ripm.length} fields in context`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-xl sm:grid-cols-3">
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
          <Slider
            label="Embedding dims"
            value={`${ripmParams.embedDims}d`}
            min={16}
            max={256}
            step={16}
            v={ripmParams.embedDims}
            onChange={(v) => setRipmParams({ embedDims: v })}
            hint="encoder dimensionality — vectors + cosine follow live"
          />
          <Chip label="Today" value="feature-hash cosine" hint="emulated encoder until pgvector exists" />
        </div>
        <ContextConfigCols enabled={ripmSet} onToggle={(k) => toggleContext("ripm", k)} />
      </PanelCard>

      {/* ══ LIPM ═════════════════════════════════════════════════════ */}
      <PanelCard
        title="LIPM · LLM match score"
        subtitle="A judge reads the merged consumer+intent profile against the full place profile — expensive, shortlist only. Same question as RIPM, higher fidelity; still text-only. Its context is configured separately: the judge usually reads MORE than the embedding (names, proof lines, hours as text)."
        pill={`${context.lipm.length} fields in context`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-xl sm:grid-cols-3">
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
          <Chip label="Today" value="RM + judgments" hint="stand-in until the judge EF exists" />
        </div>
        <div className="mt-4">
          <SubHead>Judge rubric weights</SubHead>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
            What each structured judgment is worth on top of the RM base. The Internals tab
            itemizes a verdict with exactly these numbers.
          </p>
          <div className="mt-3 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Slider
              label="Category hit"
              value={`+${lipmParams.catBonus}`}
              min={0}
              max={30}
              step={1}
              v={lipmParams.catBonus}
              onChange={(v) => setLipmParams((p) => ({ ...p, catBonus: v }))}
              hint="place category in taste/intent"
            />
            <Slider
              label="Zone hit"
              value={`+${lipmParams.zoneBonus}`}
              min={0}
              max={20}
              step={1}
              v={lipmParams.zoneBonus}
              onChange={(v) => setLipmParams((p) => ({ ...p, zoneBonus: v }))}
              hint="place zone in taste/intent"
            />
            <Slider
              label="Occasion clash"
              value={`−${lipmParams.clashPenalty}`}
              min={0}
              max={30}
              step={1}
              v={lipmParams.clashPenalty}
              onChange={(v) => setLipmParams((p) => ({ ...p, clashPenalty: v }))}
              hint="occasion × category conflict"
            />
            <Slider
              label="Nuance ±"
              value={`±${lipmParams.nuanceAmp}`}
              min={0}
              max={12}
              step={1}
              v={lipmParams.nuanceAmp}
              onChange={(v) => setLipmParams((p) => ({ ...p, nuanceAmp: v }))}
              hint="pair-stable judgment spread; 0 = none"
            />
          </div>
        </div>
        <ContextConfigCols enabled={lipmSet} onToggle={(k) => toggleContext("lipm", k)} />
      </PanelCard>

      {/* ══ WWW ══════════════════════════════════════════════════════ */}
      <PanelCard
        title="WWW · the moment — what · where · when"
        subtitle="The ONLY sub-function that computes numbers: daypart fit × distance decay × open-window. Multiplies the match in now-mode; never feeds it. Time resolves to 30-minute blocks."
      >
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>What · daypart fit</SubHead>
            <div className="mt-3">
              <Slider
                label="Off-daypart factor"
                value={`×${cfg.whatOffFactor.toFixed(2)}`}
                min={0}
                max={1}
                step={0.05}
                v={cfg.whatOffFactor}
                onChange={(v) => set("whatOffFactor", v)}
                hint={`brunch at 23:00 keeps ×${cfg.whatOffFactor.toFixed(2)} — soft; Match handles the semantic what`}
              />
            </div>
          </div>
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>Where · distance decay</SubHead>
            <div className="mt-3 flex flex-col gap-4">
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
                label="Falloff exponent · s"
                value={cfg.distanceExp.toFixed(1)}
                min={1}
                max={3}
                step={0.1}
                v={cfg.distanceExp}
                onChange={(v) => set("distanceExp", v)}
                hint="1.6 ≈ the empirical human-mobility exponent"
              />
            </div>
          </div>
          <div className="border-border/60 rounded-xl border p-4">
            <SubHead>When · wait × fit</SubHead>
            <div className="mt-3 flex flex-col gap-4">
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
              <Slider
                label="Time grid"
                value={`${Math.round(cfg.timeBlockH * 60)} min`}
                min={0.25}
                max={1}
                step={0.25}
                v={cfg.timeBlockH}
                onChange={(v) => set("timeBlockH", v)}
                hint="hours quantize to this block before wait/fit"
              />
            </div>
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.www} />
      </PanelCard>

      {/* ══ P ════════════════════════════════════════════════════════ */}
      <PanelCard
        title="P · promo score"
        subtitle="Posture from the place's live promo rates → a rung. Linear so relevance can beat money inside the paid lane; 0 = not in the paid lane (nothing to promote). Rates never reach the consumer blended-down — P reads them server-side only."
      >
        <div className="mt-4 grid max-w-md grid-cols-4 gap-2">
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
        <ContextCols ctx={PIPELINE_CONTEXT.promo} />
      </PanelCard>

      {/* ══ Persistence ══════════════════════════════════════════════ */}
      <PanelCard
        title="Saved config"
        subtitle="app_settings.scoring_config — a saved config overrides the code defaults; NULL follows them. The Playground follows whatever the form holds, saved or not."
      >
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={saving}
              className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              Reset to defaults
            </button>
            <span className="text-xs" aria-live="polite">
              {dirty && !saving ? (
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
                  Unsaved changes
                </span>
              ) : savedOk && !saving ? (
                <span className="text-muted-foreground">Saved ✓</span>
              ) : null}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={revert}
              disabled={saving || !dirty}
              className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className={
                "inline-flex h-9 items-center gap-2 rounded-full px-5 text-sm font-semibold transition " +
                (saving || dirty
                  ? "bg-pink-gradient shadow-save text-white hover:brightness-105 active:scale-[0.98] disabled:opacity-80"
                  : "bg-muted text-muted-foreground")
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
        {saveError ? <p className="mt-2 text-xs font-medium text-red-600">{saveError}</p> : null}

        {/* Definitions footer */}
        <div className="text-muted-foreground border-border/60 mt-4 flex flex-col gap-1 border-t pt-3 font-mono text-[11px] leading-relaxed">
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
            WWW = what × where × when · what = fits ? 1 : offFactor · where = 1/(1+(km/d₀)^
            {cfg.distanceExp.toFixed(1)}) · wait = 1/(1+(h/a½)^k) · fit = min(1, h/L) ·{" "}
            {Math.round(cfg.timeBlockH * 60)}-min blocks
          </p>
          <p>
            consumer+intent data carry where/when as TEXT only — WWW is the only numeric
            what/where/when, and it multiplies the match, never feeds it
          </p>
        </div>
      </PanelCard>

      <GroupHead>Every knob is a belief, not a fitted value — judge changes by break-even, not spread.</GroupHead>
    </div>
  );
}
