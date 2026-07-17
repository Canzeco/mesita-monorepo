"use client";

import {
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
  Chip,
  ContextCols,
  ContextConfigCols,
  DataAccessMatrix,
  GroupHead,
  PanelCard,
  Slider,
  SubHead,
} from "../panel-ui";
import { CongruencyCard } from "./CongruencyCard";
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
    em,
    setEm,
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
    dirty,
    saving,
    saveError,
    savedOk,
    save,
    resetToDefaults,
    revert,
  } = useScoring();

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
      {/* ══ Data access — THE core config ════════════════════════════ */}
      <PanelCard
        title="Data access · the core config"
        subtitle="Each subscore can be configured to select which data it is allowed to access — the default is all data ON; any individual data source can be toggled OFF per subscore (the spec's main knob). Four sources: Consumer (constant per consumer) · Place (constant per place) · Intent (per query — Where · When · What) · Interaction (per consumer × place, the edge — only SM can read it). Both playgrounds enforce the matrix live: revoke a source and watch that subscore's numbers move."
        pill="all data ON by default"
      >
        <DataAccessMatrix access={dataAccess} onToggle={toggleSource} />
        <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
          — = structurally unreadable (EM never sees the pair; GP/RP read only the place; XX
          reads nothing but its own draw). EM&apos;s per-field detail lives in its box below.
        </p>
      </PanelCard>

      {/* ══ EM ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="EM Subscore · Embeddings Match"
        subtitle="cosine(place vector, consumer + intent vector), clamped max(0, cos) → [0,1]. Encoder: OpenAI text-embedding-3-small at the dims below (unit vectors, so cos = A·B — pgvector computes it at recall); the playground emulates it with a feature-hash encoder. Reads TEXT only — the context below is CONFIG: click a field to include or exclude it from the embedded documents."
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
          <Slider
            label="Embedding dims"
            value={`${em.embedDims}d`}
            min={256}
            max={3072}
            step={256}
            v={em.embedDims}
            onChange={(v) => setEm({ embedDims: v })}
            hint="the API's Matryoshka `dimensions` knob — 1536 = small's native size"
          />
          <Chip label="Mapping" value="max(0, cos)" hint="revisit (percentile calibration) only if real cosines cluster" />
        </div>
        <ContextConfigCols enabled={emSet} onToggle={toggleContext} />
      </PanelCard>

      {/* ══ SM ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="SM Subscore · Structured Match — where × when × what"
        subtitle="Deterministic checks of the intent's structured asks against place facts, each factor [0,1], multiplied — any hard miss tanks the card. where measures km to the consumer's W (a named region set, else the GPS point); when = wait × fit on the real hours; what is the category ladder. Every knob is a belief argued from the product."
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
      </PanelCard>

      {/* ══ XX ═══════════════════════════════════════════════════════ */}
      <PanelCard
        title="XX Subscore · Random Number"
        subtitle="XX = U^control, U ~ Uniform[0,1) drawn fresh per card per lane (three independent draws — Organic, Inorganic, Hybrid). One deck-wide knob: control 0 → XX ≡ 1 (off, pure merit) … 5 → near-total chaos. Higher control never changes WHO is luckiest, only how much luck beats merit."
        pill={xx.control === 0 ? "off — pure merit" : `control ${xx.control.toFixed(1)}`}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl sm:grid-cols-3">
          <Slider
            label="Control"
            value={xx.control.toFixed(1)}
            min={0}
            max={5}
            step={0.5}
            v={xx.control}
            onChange={(v) => setXx({ control: v })}
            hint={
              xx.control === 0
                ? "off — every card draws XX = 1"
                : `median XX ${xxMedian.toFixed(3)} · ~${buriedPct}% of cards land below 0.1`
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
      </PanelCard>

      {/* ══ Persistence ══════════════════════════════════════════════ */}
      <PanelCard
        title="Saved config"
        subtitle="app_settings.scoring_config — a saved config overrides the code defaults; NULL follows them. Both playgrounds follow whatever the form holds, saved or not."
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

      {/* ══ Congruency — spec vs console ═════════════════════════════ */}
      <CongruencyCard />

      {/* ══ The Subscore playground ══════════════════════════════════ */}
      <SubscorePlayground />

      <GroupHead>Every knob is a belief, not a fitted value — judge changes by break-even, not spread.</GroupHead>
    </div>
  );
}
