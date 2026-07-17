"use client";

import {
  EM_ENCODER,
  gpParts,
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
  DataAccessMatrix,
  GroupHead,
  PanelCard,
  Slider,
  SubHead,
  SubscoreCard,
  SubscoreOverview,
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
    resetToDefaults,
  } = useScoring();

  // One per-box footer per section — each box saves/cancels ITSELF.
  const bar = (section: Parameters<typeof saveSection>[0]) => (
    <BoxSaveBar
      dirty={sectionDirty[section]}
      saving={savingSection === section}
      savedOk={savedSection === section}
      error={savingSection === section || sectionDirty[section] ? saveError : null}
      onSave={() => saveSection(section)}
      onCancel={() => revertSection(section)}
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
      <SubscoreOverview />

      {/* ══ Data access — THE core config ════════════════════════════ */}
      <PanelCard
        title="Data access · the core config"
        subtitle="The core knob — which of the four data sources (Consumer · Place · Intent · Interaction) each subscore may read. Default all ON; toggle any applicable cell OFF. Both playgrounds enforce it live."
        pill="all data ON by default"
      >
        <DataAccessMatrix access={dataAccess} onToggle={toggleSource} />
        <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
          — = structurally unreadable (EM never sees the pair; GP/RP read only the place; XX
          reads nothing but its own draw). EM&apos;s per-field detail lives in its box below.
        </p>
        {bar("dataAccess")}
      </PanelCard>

      {/* ══ EM ═══════════════════════════════════════════════════════ */}
      <SubscoreCard
        id="em"
        blurb="cosine(place vector, consumer + intent vector), clamped to [0,1]. Encoder is fixed (text-embedding-3-small · 1536d); the context below is CONFIG — toggle which text fields get embedded."
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
        {bar("em")}
      </SubscoreCard>

      {/* ══ SM ═══════════════════════════════════════════════════════ */}
      <SubscoreCard
        id="sm"
        blurb="where × when × what — deterministic checks of the intent's structured asks against place facts, each in [0,1], multiplied. Any hard miss tanks the card."
      >
        <div className="mt-4 grid gap-x-8 gap-y-5 lg:grid-cols-3">
          <div>
            <SubHead>where · distance decay — 1/(1+(km/tol)^k)</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Point tolerance"
                value={`${sm.where.pointTolKm.toFixed(1)} km`}
                min={0.5}
                max={20}
                step={0.5}
                v={sm.where.pointTolKm}
                onChange={(v) => setWhere("pointTolKm", v)}
                hint={`the consumer slider's default — 8 km lands at ${whereScore(8, sm.where.pointTolKm, sm.where.distExp).toFixed(2)}`}
              />
              <Slider
                label="Zone spillover"
                value={`${sm.where.zoneSpillKm.toFixed(1)} km`}
                min={0.5}
                max={10}
                step={0.5}
                v={sm.where.zoneSpillKm}
                onChange={(v) => setWhere("zoneSpillKm", v)}
                hint={`a typed zone is a constraint — 3 km past the border → ${whereScore(3, sm.where.zoneSpillKm, sm.where.distExp).toFixed(2)}`}
              />
              <Slider
                label="Distance exponent"
                value={sm.where.distExp.toFixed(1)}
                min={1}
                max={5}
                step={0.5}
                v={sm.where.distExp}
                onChange={(v) => setWhere("distExp", v)}
                hint={`doubling distance beyond tolerance costs ${Math.pow(2, sm.where.distExp).toFixed(0)}×`}
              />
            </div>
          </div>
          <div>
            <SubHead>when · wait × fit</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Wait floor"
                value={sm.when.waitFloor.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.when.waitFloor}
                onChange={(v) => setWhen("waitFloor", v)}
                hint="the weekend-only gem browsed Monday keeps this — never 0"
              />
              <Slider
                label="Wait transition"
                value={`${sm.when.waitTransitionH.toFixed(1)} h`}
                min={0.5}
                max={6}
                step={0.25}
                v={sm.when.waitTransitionH}
                onChange={(v) => setWhen("waitTransitionH", v)}
                hint={`a 2 h wait (21:00 → club at 23:00) lands at ${waitScore(2, sm.when).toFixed(2)}`}
              />
              <Slider
                label="Wait steepness"
                value={sm.when.waitSteep.toFixed(1)}
                min={1}
                max={8}
                step={0.5}
                v={sm.when.waitSteep}
                onChange={(v) => setWhen("waitSteep", v)}
                hint="4 = two plateaus, thin middle — open-now-ish vs not-open"
              />
              <Slider
                label="Session length"
                value={`${sm.when.sessionH.toFixed(1)} h`}
                min={0.5}
                max={4}
                step={0.25}
                v={sm.when.sessionH}
                onChange={(v) => setWhen("sessionH", v)}
                hint={`dinner is the archetype — 30 min left → fit ${fitScore(0.5, sm.when).toFixed(2)}`}
              />
              <Slider
                label="Time grid"
                value={`${Math.round(sm.when.timeBlockH * 60)} min`}
                min={0.25}
                max={1}
                step={0.25}
                v={sm.when.timeBlockH}
                onChange={(v) => setWhen("timeBlockH", v)}
                hint="hours quantize to this block before wait/fit"
              />
            </div>
          </div>
          <div>
            <SubHead>what · the category ladder</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Sibling rung"
                value={sm.what.sibling.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.what.sibling}
                onChange={(v) => setWhat("sibling", v)}
                hint="shares a mega category — asked cocktail bar, got a mezcalería"
              />
              <Slider
                label="Mismatch rung"
                value={sm.what.mismatch.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.what.mismatch}
                onChange={(v) => setWhat("mismatch", v)}
                hint="no overlap — floored above 0 so SM never vetoes semantics"
              />
            </div>
            <p className="text-muted-foreground mt-3 font-mono text-[10px] leading-relaxed">
              listed (or mega category listed) → 1 · sibling → {sm.what.sibling.toFixed(2)} ·
              mismatch → {sm.what.mismatch.toFixed(2)} · nothing asked → 1
            </p>
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.sm} />
        {bar("sm")}
      </SubscoreCard>

      {/* ══ GP ═══════════════════════════════════════════════════════ */}
      <SubscoreCard
        id="gp"
        blurb="min(1, ln(1 + rating × reviews) / ceiling) — total star mass, log-squashed. No reviews → 0: no Google presence means out of the organic lane."
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
        {bar("gp")}
      </SubscoreCard>

      {/* ══ RP ═══════════════════════════════════════════════════════ */}
      <SubscoreCard
        id="rp"
        blurb="Membership posture → a rung in [0,1] — BOUGHT merit, the paid lanes' multiplier. Non-members never enter the paid lanes (a lane filter, not a score); rates stay server-side."
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
        {bar("rp")}
      </SubscoreCard>

      {/* ══ XX ═══════════════════════════════════════════════════════ */}
      <SubscoreCard
        id="xx"
        blurb="U^control, drawn fresh per card per lane. Control is the CONSUMER's Randomness knob; the admin sets only the no-filter default below. 0 → off (pure merit) … 5 → near-total chaos."
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
        {bar("xx")}
      </SubscoreCard>

      {/* ══ Persistence ══════════════════════════════════════════════ */}
      <PanelCard
        title="Saved config"
        subtitle="app_settings.scoring_config — a saved config overrides the code defaults; NULL follows them. Every box above saves ITSELF (its own Save/Cancel appears when it's dirty); both playgrounds follow whatever the form holds, saved or not."
      >
        <div className="mt-4">
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={savingSection != null}
            className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            Reset all boxes to defaults
          </button>
          <span className="text-muted-foreground ml-3 text-xs">
            loads the code defaults into every box on BOTH pages — each box stays unsaved until ITS Save
          </span>
        </div>

        {/* Definitions footer */}
        <div className="text-muted-foreground border-border/60 mt-4 flex flex-col gap-1 border-t pt-3 font-mono text-[11px] leading-relaxed">
          <p>EM = max(0, cos(A, B)) · A = place doc · B = consumer + intent doc · [0,1]</p>
          <p>
            SM = where × when × what · where = 1/(1+(km/tol)^{sm.where.distExp.toFixed(1)}) · wait ={" "}
            {sm.when.waitFloor.toFixed(2)} + {(1 - sm.when.waitFloor).toFixed(2)}/(1+(h/
            {sm.when.waitTransitionH.toFixed(1)})^{sm.when.waitSteep.toFixed(1)}) · fit = min(1, h/
            {sm.when.sessionH.toFixed(1)}) · {Math.round(sm.when.timeBlockH * 60)}-min blocks
          </p>
          <p>
            GP = min(1, ln(1 + ★·n)/{gp.lnCeiling.toFixed(1)}) · RP rungs {rp.zero.toFixed(2)} /{" "}
            {rp.conservative.toFixed(2)} / {rp.aggressive.toFixed(2)} / {rp.dominant.toFixed(2)} ·
            XX = U^{xx.control.toFixed(1)}
          </p>
          <p>EM reads TEXT only — SM · GP · RP · XX are the numeric subscores; they multiply EM, never feed it</p>
        </div>
      </PanelCard>

      {/* ══ The Subscore playground ══════════════════════════════════ */}
      <SubscorePlayground />

      <GroupHead>Every knob is a belief, not a fitted value — judge changes by break-even, not spread.</GroupHead>
    </div>
  );
}
