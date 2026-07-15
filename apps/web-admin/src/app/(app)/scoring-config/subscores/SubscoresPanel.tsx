"use client";

import {
  ES_MAX,
  gpParts,
  laneFormula,
  LANES,
  PIPELINE_CONTEXT,
  RP_MAX,
  fitScore,
  waitScore,
  whereScore,
  type IcParams,
} from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { useScoring } from "../ScoringProvider";
import {
  Chip,
  ContextCols,
  ContextConfigCols,
  LANE_SHORT,
  PanelPill,
  Slider,
  SubHead,
} from "../panel-ui";

// Subscores — divide et impera: ONE BOX PER SUBSCORE, each with its own
// knobs AND its data-access contract (which consumer / intent / place fields
// it reads — the PIPELINE_CONTEXT spec in @/lib/business/scores).
//
//   ES  Embeddings Similarity — documents in, cosine out (context = CONFIG)
//   GP  Google Popularity — smooth volume × quality
//   RP  Rewards Promotions — posture from the live rates
//   IC  Intent Context — where × when, the intent's numeric context
//   CH  Context History — Swipe-only pair history; STUB 1, no knobs yet
//
// Deck maxes live on the Decks tab (deck-layer config, not Subscore params).
// Values set here drive the Cards and Decks tabs live (shared provider) and
// persist to app_settings.scoring_config via the save bar at the bottom.

export function SubscoresPanel() {
  const {
    retrieval,
    setRetrieval,
    esParams,
    setEsParams,
    gpParams,
    setGpParams,
    rpVals,
    setRpVals,
    cfg,
    setCfg,
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

  const esSet = new Set(context.es);

  const setIc = <K extends keyof IcParams>(k: K, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));

  // GP's quality curve at the CURRENT knobs — every hint recomputes live.
  const quality = (stars: number) =>
    1 / (1 + Math.exp(-gpParams.qualitySteep * (stars - gpParams.qualityMid)));
  const volumeOf = (reviews: number) =>
    Math.max(0, Math.min(1, Math.log10(1 + reviews) / Math.log10(1 + gpParams.refCount)));

  // The archetype strip — live worked examples, doubling as the regression
  // test for knob edits (drag a knob, watch the archetypes move).
  const archetypes = [
    { label: "the institution", reviews: 3000, stars: 4.5 },
    { label: "the solid local", reviews: 150, stars: 4.2 },
    { label: "the newcomer", reviews: 3, stars: 5.0 },
    { label: "the 1★-farm test", reviews: 10000, stars: 3.0 },
  ].map((a) => ({ ...a, parts: gpParts(a.reviews, a.stars, gpParams) }));

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ ES ═══════════════════════════════════════════════════════ */}
      <SectionCard
        title="ES Subscore · Embeddings Similarity"
        subtitle="cosine(consumer+intent embedding, place embedding) — one tier, whole catalog; there is no judge. Reads TEXT only: address, hours and time appear as words, never as computed numbers. The context below is CONFIG — click a field to include or exclude it from the embedded documents; the Cards tab re-embeds and re-ranks from exactly this set."
        action={<PanelPill>{`${context.es.length} fields in context`}</PanelPill>}
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
            hint="places pgvector returns per query — the decks compose from these"
          />
          <Slider
            label="Embedding dims"
            value={`${esParams.embedDims}d`}
            min={16}
            max={256}
            step={16}
            v={esParams.embedDims}
            onChange={(v) => setEsParams({ embedDims: v })}
            hint="encoder dimensionality — vectors + cosine follow live"
          />
          <Chip label="Today" value="feature-hash cosine" hint="emulated encoder until pgvector exists" />
        </div>
        <ContextConfigCols enabled={esSet} onToggle={toggleContext} />
      </SectionCard>

      {/* ══ GP ═══════════════════════════════════════════════════════ */}
      <SectionCard
        title="GP Subscore · Google Popularity"
        subtitle="Smooth volume × quality of the place's google reviews — EARNED popularity, the organic lanes' multiplier. Literal reviews × rating was rejected (1★-farmable, rating-decorative) and so was a hard hinge at 3★ (cliff); this is smooth everywhere. The cold-start floor keeps unreviewed places organically alive."
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          <Slider
            label="Reference volume"
            value={gpParams.refCount.toLocaleString("en-US")}
            min={500}
            max={20000}
            step={500}
            v={gpParams.refCount}
            onChange={(v) => setGpParams((p) => ({ ...p, refCount: v }))}
            hint={`1,000 reviews → volume ${volumeOf(1000).toFixed(2)} · ${gpParams.refCount.toLocaleString("en-US")}+ → 1.00`}
          />
          <Slider
            label="Quality midpoint"
            value={`${gpParams.qualityMid.toFixed(2)}★`}
            min={3}
            max={4.5}
            step={0.05}
            v={gpParams.qualityMid}
            onChange={(v) => setGpParams((p) => ({ ...p, qualityMid: v }))}
            hint={`a ${gpParams.qualityMid.toFixed(2)}★ place scores 0.50 · 4.5★ → ${quality(4.5).toFixed(2)}`}
          />
          <Slider
            label="Quality steepness"
            value={gpParams.qualitySteep.toFixed(2)}
            min={0.5}
            max={5}
            step={0.25}
            v={gpParams.qualitySteep}
            onChange={(v) => setGpParams((p) => ({ ...p, qualitySteep: v }))}
            hint={`3.0★ → ${quality(3).toFixed(2)} · 4.5★ → ${quality(4.5).toFixed(2)} — the gap IS the knob`}
          />
          <Slider
            label="Cold-start floor"
            value={gpParams.coldStartFloor.toFixed(2)}
            min={0}
            max={0.5}
            step={0.05}
            v={gpParams.coldStartFloor}
            onChange={(v) => setGpParams((p) => ({ ...p, coldStartFloor: v }))}
            hint={`unreviewed places keep ≥ ${gpParams.coldStartFloor.toFixed(2)} of their organic weight`}
          />
          <Slider
            label="Floor applies under"
            value={`${gpParams.minReviews} reviews`}
            min={0}
            max={50}
            step={1}
            v={gpParams.minReviews}
            onChange={(v) => setGpParams((p) => ({ ...p, minReviews: v }))}
            hint={`${gpParams.minReviews}+ reviews → the curve speaks for itself`}
          />
        </div>
        <div className="mt-4">
          <SubHead>Worked examples · live at these knobs</SubHead>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {archetypes.map((a) => (
              <div key={a.label} className="bg-muted/60 border-border/60 rounded-xl border px-2.5 py-2">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.04em] uppercase">
                  {a.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px]">
                  {a.stars.toFixed(1)}★ × {a.reviews.toLocaleString("en-US")}
                </p>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-snug">
                  {a.parts.floored
                    ? `raw ${a.parts.raw.toFixed(2)} → floor → `
                    : `vol ${a.parts.volume.toFixed(2)} × qual ${a.parts.quality.toFixed(2)} → `}
                  <b className="text-foreground">GP {a.parts.gp.toFixed(2)}</b>
                </p>
              </div>
            ))}
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.gp} />
      </SectionCard>

      {/* ══ RP ═══════════════════════════════════════════════════════ */}
      <SectionCard
        title="RP Subscore · Rewards Promotions"
        subtitle="Posture from the place's live promo rates → a rung — BOUGHT popularity, the paid lanes' multiplier. Linear so relevance can beat money inside the paid lane; 0 = not in the paid lane (nothing to promote). Rates never reach the consumer blended-down — RP reads them server-side only."
      >
        <div className="mt-4 grid max-w-md grid-cols-4 gap-2">
          {STRATEGIES.map((s) => (
            <div key={s.id} className="bg-muted/60 border-border/60 rounded-xl border px-2 py-2.5 text-center">
              <p className="text-muted-foreground text-[11px]">{s.name}</p>
              <input
                type="number"
                min={0}
                max={RP_MAX}
                step={1}
                value={rpVals[s.id]}
                onChange={(e) =>
                  setRpVals((p) => ({
                    ...p,
                    [s.id]: Math.max(0, Math.min(RP_MAX, Number(e.target.value))),
                  }))
                }
                aria-label={`RP rung for ${s.name}`}
                className="border-border/70 bg-card font-display mt-1 w-14 rounded-lg border px-1 py-0.5 text-center text-lg font-semibold tabular-nums"
              />
            </div>
          ))}
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.rp} />
      </SectionCard>

      {/* ══ IC ═══════════════════════════════════════════════════════ */}
      <SectionCard
        title="IC Subscore · Intent Context — where · when"
        subtitle="How the place sits in the intent's numeric context: distance decay × open-window. Multiplies the match in now-mode; never feeds it. Time resolves to 30-minute blocks. (The daypart WHAT term was deleted in v9 — ES alone carries semantic fit.)"
      >
        <div className="mt-4 grid gap-x-8 gap-y-5 lg:grid-cols-2">
          <div>
            <SubHead>Where · distance decay</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Half-pull radius · d₀"
                value={`${cfg.distanceHalfKm.toFixed(1)} km`}
                min={1}
                max={20}
                step={0.5}
                v={cfg.distanceHalfKm}
                onChange={(v) => setIc("distanceHalfKm", v)}
                hint={`20 km lands at ${whereScore(20, cfg).toFixed(2)}`}
              />
              <Slider
                label="Falloff exponent · s"
                value={cfg.distanceExp.toFixed(1)}
                min={1}
                max={3}
                step={0.1}
                v={cfg.distanceExp}
                onChange={(v) => setIc("distanceExp", v)}
                hint="1.6 ≈ the empirical human-mobility exponent"
              />
            </div>
          </div>
          <div>
            <SubHead>When · wait × fit</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Wait half-life · a½"
                value={`${cfg.waitHalfH.toFixed(1)} h`}
                min={0.5}
                max={4}
                step={0.25}
                v={cfg.waitHalfH}
                onChange={(v) => setIc("waitHalfH", v)}
                hint={`a 2 h wait lands at ${waitScore(2, cfg).toFixed(2)}`}
              />
              <Slider
                label="Cliff sharpness · k"
                value={cfg.waitExp.toFixed(2)}
                min={1}
                max={5}
                step={0.25}
                v={cfg.waitExp}
                onChange={(v) => setIc("waitExp", v)}
                hint={
                  cfg.waitExp <= 1.25
                    ? "no plateau — every block costs"
                    : `30 min → ${waitScore(0.5, cfg).toFixed(2)} · plateau then cliff`
                }
              />
              <Slider
                label="Session length · L"
                value={`${cfg.sessionH.toFixed(1)} h`}
                min={0.5}
                max={4}
                step={0.25}
                v={cfg.sessionH}
                onChange={(v) => setIc("sessionH", v)}
                hint={`30 min left → fit ${fitScore(0.5, cfg).toFixed(2)}`}
              />
              <Slider
                label="Time grid"
                value={`${Math.round(cfg.timeBlockH * 60)} min`}
                min={0.25}
                max={1}
                step={0.25}
                v={cfg.timeBlockH}
                onChange={(v) => setIc("timeBlockH", v)}
                hint="hours quantize to this block before wait/fit"
              />
            </div>
          </div>
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.ic} />
      </SectionCard>


      {/* ══ CH ═══════════════════════════════════════════════════════ */}
      <SectionCard
        title="CH Subscore · Context History"
        subtitle="The consumer × place PAIR's history — did this consumer save this place, visit it, skip it n times in the deck? SWIPE-ONLY: it multiplies all four Swipe lanes; Map and Pre-Memo skip it. A STUB today — always 1, so no number moves anywhere — until the history starts boosting/penalizing."
        action={<PanelPill>Swipe only</PanelPill>}
      >
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-xl sm:grid-cols-3">
          <Chip label="Today" value="always 1" hint="stub — boosts/penalties arrive with the history data" />
          <Chip label="Knobs" value="none yet" hint="they join the saved blob when CH stops being a stub" />
        </div>
        <ContextCols ctx={PIPELINE_CONTEXT.ch} />
      </SectionCard>

      {/* ══ Persistence ══════════════════════════════════════════════ */}
      <SectionCard
        title="Saved config"
        subtitle="app_settings.scoring_config — a saved config overrides the code defaults; NULL follows them. The Cards and Decks tabs follow whatever the form holds, saved or not — Cards is the playground that walks every Subscore's internals."
      >
        <SaveBar
          pending={saving}
          dirty={dirty}
          ok={savedOk}
          onSave={save}
          onCancel={revert}
          onReset={resetToDefaults}
          error={saveError}
        />

        {/* Definitions footer */}
        <div className="text-muted-foreground border-border/60 mt-4 flex flex-col gap-1 border-t pt-3 font-mono text-[11px] leading-relaxed">
          <p>
            lanes:{" "}
            {LANES.map((l) => `${LANE_SHORT[l.id]} ${l.lane} ${l.mode} = ${laneFormula(l)}`).join("  ·  ")}
          </p>
          <p>
            ES = embeddings cosine · 0–{ES_MAX} · GP = volume × quality · 0–1 · RP = rates → posture
            → rung · 0–{RP_MAX} · IC = where × when · 0–1 · CH = context history · Swipe only ·
            stub 1
          </p>
          <p>
            GP = log10(1+n)/log10(1+{gpParams.refCount.toLocaleString("en-US")}) ×
            1/(1+e^(−{gpParams.qualitySteep.toFixed(1)}·(★−{gpParams.qualityMid.toFixed(2)}))) ·
            floor {gpParams.coldStartFloor.toFixed(2)} under {gpParams.minReviews} reviews
          </p>
          <p>
            IC: where = 1/(1+(km/d₀)^{cfg.distanceExp.toFixed(1)}) · wait = 1/(1+(h/a½)^k) · fit =
            min(1, h/L) · {Math.round(cfg.timeBlockH * 60)}-min blocks
          </p>
          <p>
            ES reads TEXT only — GP · RP · IC are the numeric Subscores, and they multiply ES,
            never feed it
          </p>
        </div>
      </SectionCard>

      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
        Every knob is a belief, not a fitted value — judge changes by break-even, not spread.
      </p>
    </div>
  );
}
