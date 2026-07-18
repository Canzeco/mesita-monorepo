"use client";

import {
  DEFAULT_POINT_TOL_KM,
  EM_ENCODER,
  gpParts,
  MISMATCH_RUNG,
  PIPELINE_CONTEXT,
  fitScore,
  waitScore,
  whereScore,
  xxScore,
  type SmParams,
} from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import {
  BoxSaveBar,
  Chip,
  ContextCols,
  ContextConfigCols,
  GroupHead,
  PanelCard,
  Slider,
  SubHead,
  SubscoreDataAccess,
} from "../panel-ui";
import { SubscorePlayground } from "./SubscorePlayground";

// Subscores — ONE BOX PER SUBSCORE (EM · SM · GP · RP · XX), each with its
// knobs AND its data-access contract. Every subscore outputs [0,1], so a
// lane score (the product on the Scores & Lanes tab) is itself [0,1].
//
//   EM  Embeddings Match — documents in, cosine out (context = CONFIG)
//   SM  Structured Match — where × when × what, the intent's structured asks
//   GP  Google Popularity — ln(1 + rating × reviews) / ceiling
//   RP  Rewards Promotions — posture from the live rates → a rung
//   XX  Random Number — U^control, per card per lane
//
// Values set here drive BOTH playgrounds live (shared provider) and persist
// to app_settings.scoring_config via the save bar. The Subscore playground
// at the bottom walks every subscore's internals on ONE consumer × intent ×
// place.

export function SubscoresPanel() {
  const {
    recallTopK,
    setRecallTopK,
    sm,
    setSm,
    gp,
    setGp,
    rp,
    setRp,
    xx,
    setXx,
    dataAccess,
    toggleSource,
    context,
    toggleContext,
    sectionDirty,
    savingSection,
    saveError,
    savedSection,
    saveSection,
    revertSection,
    resetSection,
  } = useScoring();

  // One per-box footer per section — each box saves / resets / cancels ITSELF.
  const bar = (section: Parameters<typeof saveSection>[0]) => (
    <BoxSaveBar
      dirty={sectionDirty[section]}
      saving={savingSection === section}
      savedOk={savedSection === section}
      error={savingSection === section || sectionDirty[section] ? saveError : null}
      onSave={() => saveSection(section)}
      onCancel={() => revertSection(section)}
      onReset={() => resetSection(section)}
    />
  );

  const emSet = new Set(context.em);

  const setWhere = <K extends keyof SmParams["where"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, where: { ...s.where, [k]: v } }));
  const setWhen = <K extends keyof SmParams["when"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, when: { ...s.when, [k]: v } }));
  const setWhat = <K extends keyof SmParams["what"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, what: { ...s.what, [k]: v } }));

  // GP worked examples — live at the current ceiling; the regression strip
  // for knob edits (drag the knob, watch the archetypes move).
  const gpArchetypes = [
    { label: "the institution", reviews: 3000, stars: 4.5 },
    { label: "the solid local", reviews: 150, stars: 4.2 },
    { label: "the newcomer", reviews: 5, stars: 5.0 },
    { label: "no google presence", reviews: 0, stars: null as number | null },
  ].map((a) => ({ ...a, parts: gpParts(a.reviews, a.stars, gp) }));

  // XX's feel at the current control — median and the buried share.
  const xxMedian = Math.pow(0.5, xx.control);
  const buriedPct = xx.control <= 0 ? 0 : Math.round((1 - Math.pow(0.1, 1 / xx.control)) * 100);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ EM ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="EM Subscore · Embeddings Match"
        subtitle="cosine(place vector, consumer + intent vector), clamped max(0, cos) → [0,1]. The encoder is a FIXED decision, not a param: OpenAI text-embedding-3-small at its native 1536 dims (unit vectors, so cos = A·B — pgvector computes it at recall); the playground emulates it with a feature-hash encoder. Reads TEXT only — the context below is CONFIG: click a field to include or exclude it from the embedded documents."
        pill={`${context.em.length} fields in context`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-xl sm:grid-cols-3">
          <Slider
            label="Recall top-K"
            value={String(recallTopK)}
            min={10}
            max={200}
            step={10}
            v={recallTopK}
            onChange={setRecallTopK}
            hint="places pgvector returns per query, metro-filtered — the lanes score these"
          />
          <Chip
            label="Encoder · fixed"
            value={`${EM_ENCODER.model} · ${EM_ENCODER.dims}d`}
            hint="a decision, not a knob — changing encoder = a new decision + catalog re-embed"
          />
          <Chip label="Mapping" value="max(0, cos)" hint="revisit (percentile calibration) only if real cosines cluster" />
        </div>
        <ContextConfigCols enabled={emSet} onToggle={toggleContext} />
        <SubscoreDataAccess subscore="em" access={dataAccess} onToggle={toggleSource} />
        {bar("em")}
      </PanelCard>

      {/* ══ SM ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="SM Subscore · Structured Match — where × when × what"
        subtitle="Deterministic checks of the intent's structured asks against place facts, each factor [0,1], multiplied — any hard miss tanks the card. where and when are CONTINUOUS curves, never buckets; what is the one categorical ladder. The consumer owns the where tolerance (their Where filter slider; default 5 km, frozen) — the admin tunes only how hard distance bites. 1 · 2 · 1 knobs, every one a belief argued from the product."
      >
        <div className="mt-4 grid gap-x-8 gap-y-5 lg:grid-cols-3">
          <div>
            <SubHead>where · one knob — how hard distance bites</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Distance falloff"
                value={sm.where.distExp.toFixed(1)}
                min={1}
                max={5}
                step={0.5}
                v={sm.where.distExp}
                onChange={(v) => setWhere("distExp", v)}
                hint={`the exponent — doubling distance beyond tolerance costs ${Math.pow(2, sm.where.distExp).toFixed(0)}×; at the default ${DEFAULT_POINT_TOL_KM} km tolerance, 8 km → ${whereScore(8, DEFAULT_POINT_TOL_KM, sm.where.distExp).toFixed(2)}`}
              />
            </div>
            <p className="text-muted-foreground mt-3 font-mono text-[10px] leading-relaxed">
              tolerance = the consumer&apos;s Where slider (default {DEFAULT_POINT_TOL_KM} km,
              frozen) · a named zone uses 30% of it · continuous, never a bucket
            </p>
          </div>
          <div>
            <SubHead>when · two knobs — closed-now, visit length</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Closed-now floor"
                value={sm.when.waitFloor.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.when.waitFloor}
                onChange={(v) => setWhen("waitFloor", v)}
                hint={`a place shut at the intent time floors here — a 2 h wait lands at ${waitScore(2, sm.when).toFixed(2)}; never 0`}
              />
              <Slider
                label="Session length"
                value={`${sm.when.sessionH.toFixed(1)} h`}
                min={0.5}
                max={4}
                step={0.25}
                v={sm.when.sessionH}
                onChange={(v) => setWhen("sessionH", v)}
                hint={`hours the visit needs — 30 min left → fit ${fitScore(0.5, sm.when).toFixed(2)}`}
              />
            </div>
            <p className="text-muted-foreground mt-3 font-mono text-[10px] leading-relaxed">
              transition (2 h) · steepness (4) · 30-min grid are frozen constants
            </p>
          </div>
          <div>
            <SubHead>what · one knob — the category ladder</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Super-category rung"
                value={sm.what.sibling.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.what.sibling}
                onChange={(v) => setWhat("sibling", v)}
                hint="same super category, different category — asked cocktail bar, got a mezcalería"
              />
            </div>
            <p className="text-muted-foreground mt-3 font-mono text-[10px] leading-relaxed">
              categorical on purpose: same category → 1 · same super category →{" "}
              {sm.what.sibling.toFixed(2)} · none → {MISMATCH_RUNG.toFixed(2)} (frozen, never 0)
              · nothing asked → 1
            </p>
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.sm} />
        <SubscoreDataAccess subscore="sm" access={dataAccess} onToggle={toggleSource} />
        {bar("sm")}
      </PanelCard>

      {/* ══ GP ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="GP Subscore · Google Popularity"
        subtitle="min(1, ln(1 + rating × reviews) / ceiling) — total star mass, log-squashed. A simple log, NOT a sigmoid: a sigmoid needs a 'typical popularity' center (a scale assumption); the log needs one ceiling knob. No reviews → 0: no Google presence means out of the organic lane."
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-xl sm:grid-cols-3">
          <Slider
            label="ln ceiling"
            value={gp.lnCeiling.toFixed(1)}
            min={5}
            max={15}
            step={0.5}
            v={gp.lnCeiling}
            onChange={(v) => setGp({ lnCeiling: v })}
            hint={`GP hits 1 at e^${gp.lnCeiling.toFixed(1)} ≈ ${Math.round(Math.exp(gp.lnCeiling)).toLocaleString("en-US")} star mass — each ×e adds ${(1 / gp.lnCeiling).toFixed(2)}`}
          />
          <Chip
            label="Reading"
            value={`${gp.lnCeiling.toFixed(0)} e-folds span 0→1`}
            hint="≈ 4.5★ × ~4,900 reviews reads fully popular at the default 10"
          />
        </div>
        <div className="mt-4">
          <SubHead>Worked examples · live at this ceiling</SubHead>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {gpArchetypes.map((a) => (
              <div key={a.label} className="bg-muted/60 border-border/60 rounded-xl border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.04em] uppercase">
                  {a.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px]">
                  {a.stars != null ? `${a.stars.toFixed(1)}★ × ${a.reviews.toLocaleString("en-US")}` : "—"}
                </p>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-snug">
                  raw {a.parts.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })} →{" "}
                  <b className="text-foreground">GP {a.parts.gp.toFixed(2)}</b>
                </p>
              </div>
            ))}
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.gp} />
        <SubscoreDataAccess subscore="gp" access={dataAccess} onToggle={toggleSource} />
        {bar("gp")}
      </PanelCard>

      {/* ══ RP ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="RP Subscore · Rewards Promotions"
        subtitle="Posture from the place's live promo rates → a rung in [0,1] — BOUGHT merit, the paid lanes' multiplier. No literal 0: non-members never enter the paid lanes at all (a lane filter, not a score); the zero-posture member keeps a whisper. Rates never reach the consumer — RP reads them server-side only."
      >
        <div className="mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {STRATEGIES.map((s) => (
            <div key={s.id} className="bg-muted/60 border-border/60 rounded-xl border px-2.5 py-2.5">
              <p className="text-muted-foreground text-center text-[11px]">{s.name}</p>
              <p className="font-display mt-0.5 text-center text-lg font-semibold tabular-nums">
                {rp[s.id].toFixed(2)}
              </p>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={rp[s.id]}
                onChange={(e) =>
                  setRp((p) => ({
                    ...p,
                    [s.id]: Math.max(0, Math.min(1, Number(e.target.value))),
                  }))
                }
                aria-label={`RP rung for ${s.name}`}
                className="accent-primary mt-1 w-full"
              />
            </div>
          ))}
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.rp} />
        <SubscoreDataAccess subscore="rp" access={dataAccess} onToggle={toggleSource} />
        {bar("rp")}
      </PanelCard>

      {/* ══ XX ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="XX Subscore · Random Number"
        subtitle="XX = U^control, U ~ Uniform[0,1) drawn fresh per card per lane (three independent draws — Organic, Inorganic, Hybrid). Control is the CONSUMER'S knob — the Randomness filter sets it per query. The admin configures only the DEFAULT below: what Lineup uses when the consumer sets no filter. 0 → XX ≡ 1 (off, pure merit) … 5 → near-total chaos; higher control never changes WHO is luckiest, only how much luck beats merit."
        pill={xx.control === 0 ? "default: off — pure merit" : `default control ${xx.control.toFixed(1)}`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-3">
          <Slider
            label="Default control · no-filter value"
            value={xx.control.toFixed(1)}
            min={0}
            max={5}
            step={0.5}
            v={xx.control}
            onChange={(v) => setXx({ control: v })}
            hint={
              (xx.control === 0
                ? "off — every card draws XX = 1"
                : `median XX ${xxMedian.toFixed(3)} · ~${buriedPct}% of cards land below 0.1`) +
              " · the consumer's Randomness filter overrides this per query"
            }
          />
          <Chip
            label="Ladder"
            value={`U¹ ${xxScore(0.5, 1).toFixed(2)} · U³ ${xxScore(0.5, 3).toFixed(2)} · U⁵ ${xxScore(0.5, 5).toFixed(3)}`}
            hint="the median card at control 1 / 3 / 5 — frozen → boiling"
          />
          <Chip label="Determinism" value="seeded per (card, lane, roll)" hint="the playgrounds re-roll on demand; live decks draw fresh" />
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.xx} />
        <SubscoreDataAccess subscore="xx" access={dataAccess} onToggle={toggleSource} />
        {bar("xx")}
      </PanelCard>

      {/* ══ Definitions · a footnote, not a config box ═══════════════ */}
      <div className="border-border bg-muted/30 text-muted-foreground rounded-2xl border px-5 py-4 leading-relaxed">
        <p className="text-foreground/80 mb-2 text-[11px] font-semibold tracking-tight">
          Saved to app_settings.scoring_config — a saved config overrides the code defaults; NULL
          follows them. Each box above Saves · Resets · Cancels ITSELF; both playgrounds follow
          whatever the form holds, saved or not.
        </p>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          <p>EM = max(0, cos(A, B)) · A = place doc · B = consumer + intent doc · [0,1]</p>
          <p>
            SM = where × when × what · where = 1/(1+(km/tol)^{sm.where.distExp.toFixed(1)}) · tol
            = consumer slider (default {DEFAULT_POINT_TOL_KM} km) · wait ={" "}
            {sm.when.waitFloor.toFixed(2)} + {(1 - sm.when.waitFloor).toFixed(2)}/(1+(h/2)^4) · fit =
            min(1, h/{sm.when.sessionH.toFixed(1)}) · 30-min blocks
          </p>
          <p>
            GP = min(1, ln(1 + ★·n)/{gp.lnCeiling.toFixed(1)}) · RP rungs {rp.zero.toFixed(2)} /{" "}
            {rp.conservative.toFixed(2)} / {rp.aggressive.toFixed(2)} / {rp.dominant.toFixed(2)} ·
            XX = U^{xx.control.toFixed(1)}
          </p>
          <p>EM reads TEXT only — SM · GP · RP · XX are the numeric subscores; they multiply EM, never feed it</p>
        </div>
      </div>

      {/* ══ The Subscore playground ══════════════════════════════════ */}
      <SubscorePlayground />

      <GroupHead>Every knob is a belief, not a fitted value — judge changes by break-even, not spread.</GroupHead>
    </div>
  );
}
