"use client";

import {
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
  MiniTile,
  PanelCard,
  Slider,
  SubHead,
  SubscoreDataAccess,
} from "../panel-ui";

// Subscores — TUNE, nothing else (4-subpage restructure 2026-07-20): ONE BOX
// PER SUBSCORE (EM · SM · GP · RP · XX), each with its knobs, its data-access
// contract, and its own save bar. Every subscore outputs [0,1], so a lane
// score (the product, shown on the Scores tab) is itself [0,1].
//
// Values set here drive the Scores tab's live definitions and both
// playgrounds live (shared provider) and persist to
// app_settings.scoring_config via each box's save bar. Each box carries an
// anchor id (em·sm·gp·rp·xx) — the Scores tab's factor chips deep-link here.

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
      <section id="em" className="scroll-mt-24">
      <PanelCard
        title="EM Subscore · Embeddings Match"
        subtitle="max(0, cos(place vector, consumer + intent vector)) → [0,1] — EM reads TEXT only; click a field below to include or exclude it from the embedded documents."
        pill={`${context.em.length} fields in context`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-3">
          <Slider
            label="Recall top-K"
            value={String(recallTopK)}
            min={10}
            max={200}
            step={10}
            v={recallTopK}
            onChange={setRecallTopK}
            hint="places recalled per query (metro-filtered) — the lanes score these"
          />
          <Chip
            label="Encoder · fixed"
            value={`${EM_ENCODER.model} · ${EM_ENCODER.dims}d`}
            hint="a decision, not a knob — a new encoder means a catalog re-embed"
          />
        </div>
        <ContextConfigCols enabled={emSet} onToggle={toggleContext} />
        <SubscoreDataAccess subscore="em" access={dataAccess} onToggle={toggleSource} />
        {bar("em")}
      </PanelCard>
      </section>

      {/* ══ SM ═══════════════════════════════════════════════════════ */}
      <section id="sm" className="scroll-mt-24">
      <PanelCard
        title="SM Subscore · Structured Match — where × when × what"
        subtitle="The intent's structured asks against place facts — where/when are continuous curves, what is the categorical ladder; 1 · 2 · 1 hyperparameters, plus the GREEN consumer default (distance tolerance) the user's Where slider overrides per query."
      >
        <div className="mt-4 grid gap-x-8 gap-y-5 lg:grid-cols-3">
          <div>
            <SubHead>where · a green default + one hyperparameter</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                consumer
                label="Default tolerance"
                value={`${sm.where.defaultTolKm.toFixed(1)} km`}
                min={0.5}
                max={20}
                step={0.5}
                v={sm.where.defaultTolKm}
                onChange={(v) => setWhere("defaultTolKm", v)}
                hint="GREEN = consumer-overridable: this is only the no-filter fallback — the consumer's own Where slider sets the real tolerance per query (when/what knobs have no such override)"
              />
              <Slider
                label="Distance falloff"
                value={sm.where.distExp.toFixed(1)}
                min={1}
                max={5}
                step={0.5}
                v={sm.where.distExp}
                onChange={(v) => setWhere("distExp", v)}
                hint={`the exponent — doubling distance beyond tolerance costs ${Math.pow(2, sm.where.distExp).toFixed(0)}×; at ${sm.where.defaultTolKm.toFixed(1)} km tolerance, 8 km → ${whereScore(8, sm.where.defaultTolKm, sm.where.distExp).toFixed(2)}`}
              />
            </div>
            <p className="text-muted-foreground mt-3 font-mono text-[10px] leading-relaxed">
              tolerance = the consumer&apos;s Where slider; unset → the green default · a named
              zone uses 30% of it · continuous, never a bucket
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
      </section>

      {/* ══ GP ═══════════════════════════════════════════════════════ */}
      <section id="gp" className="scroll-mt-24">
      <PanelCard
        title="GP Subscore · Google Popularity"
        subtitle="min(1, ln(1 + rating × reviews) / ceiling) — earned popularity, log-squashed; no Google presence → 0 (out of the organic lanes)."
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-3">
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
              <MiniTile
                key={a.label}
                label={a.label}
                value={
                  a.stars != null
                    ? `${a.stars.toFixed(1)}★ × ${a.reviews.toLocaleString("en-US")}`
                    : "—"
                }
              >
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-snug">
                  raw {a.parts.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })} →{" "}
                  <b className="text-foreground">GP {a.parts.gp.toFixed(2)}</b>
                </p>
              </MiniTile>
            ))}
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.gp} />
        <SubscoreDataAccess subscore="gp" access={dataAccess} onToggle={toggleSource} />
        {bar("gp")}
      </PanelCard>
      </section>

      {/* ══ RP ═══════════════════════════════════════════════════════ */}
      <section id="rp" className="scroll-mt-24">
      <PanelCard
        title="RP Subscore · Rewards Promotions"
        subtitle="The place's live promo rates → posture → a rung in [0,1] — bought merit; rates never reach the consumer."
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-4">
          {STRATEGIES.map((s) => (
            <Slider
              key={s.id}
              label={s.name}
              value={rp[s.id].toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              v={rp[s.id]}
              onChange={(v) =>
                setRp((p) => ({ ...p, [s.id]: Math.max(0, Math.min(1, v)) }))
              }
              hint={`the ${s.name.toLowerCase()} posture's rung`}
            />
          ))}
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.rp} />
        <SubscoreDataAccess subscore="rp" access={dataAccess} onToggle={toggleSource} />
        {bar("rp")}
      </PanelCard>
      </section>

      {/* ══ XX ═══════════════════════════════════════════════════════ */}
      <section id="xx" className="scroll-mt-24">
      <PanelCard
        title="XX Subscore · Random Number"
        subtitle="U^control, drawn per card per lane — the admin sets only the no-filter DEFAULT; the consumer's Randomness filter overrides it per query."
        pill={xx.control === 0 ? "default: off — pure merit" : `default control ${xx.control.toFixed(1)}`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-3">
          <Slider
            consumer
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
            hint="the median card at control 1 / 3 / 5 — seeded per (card, lane, roll); live decks draw fresh"
          />
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.xx} />
        <SubscoreDataAccess subscore="xx" access={dataAccess} onToggle={toggleSource} />
        {bar("xx")}
      </PanelCard>
      </section>

      <GroupHead>Every knob is a belief, not a fitted value — judge changes by break-even, not spread.</GroupHead>
    </div>
  );
}
