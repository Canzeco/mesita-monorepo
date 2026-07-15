"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Braces, Gauge } from "lucide-react";
import {
  rpForStrategy,
  RP_BY_STRATEGY,
  strategyForPlace,
  STRATEGIES,
  STRATEGY_BY_ID,
  type StrategyId,
} from "@/lib/business/strategies";
import {
  DEFAULT_IC_PARAMS as CFG,
  ES_MAX,
  fitScore,
  gpParts,
  laneScore,
  LANES,
  quantizeH,
  RP_MAX,
  waitScore,
  whenScore,
  whereScore,
  type Lane,
} from "@/lib/business/scores";
import type { AdminPlace } from "../actions";
import { GroupLabel, SectionCard, TINT_CHIP } from "../ui";

// ════════════════════════════════════════════════════════════════════════
// Scores — this place's potency in the recommendation engines (Swipe · Map ·
// Memo). Admin-only: the whole console sits behind the super-admin gate.
//
// This file RENDERS the model; the model, its knobs and the reasoning behind
// every one live in @/lib/business/scores (RP in ./strategies), and the
// global view is Scoring Config. Four Lanes, one Score each:
//
//   ON = ES · GP · IC     OF = ES · GP
//   IN = ES · RP · IC     IF = ES · RP
//
// TWO Sub-Scores are real data here: GP (the place's google rating × review
// count) and RP (its live promo rates). There is no consumer and no query in
// an admin view, so ES and the intent context (IC) are operator controls —
// that is the nature of the surface, not a gap in it. This page uses the
// CODE defaults for GP/IC knobs, same as it always has — the saved blob
// binds the Scoring Config page, not this one.
// ════════════════════════════════════════════════════════════════════════

/** Deterministic pseudo-vector from the place id — stand-in until real embeddings exist. */
function mockVector(seed: string, dims: number): number[] {
  const out: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < dims; i++) {
    const c = seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h ^ c, 16777619);
    out.push(((h >>> 8) % 1000) / 1000);
  }
  return out;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

export function ScoresSection({ place }: { place: AdminPlace }) {
  // The query and the consumer don't exist here, so these are controls.
  const [es, setEs] = useState(ES_MAX);
  const [km, setKm] = useState(2);
  const [opensIn, setOpensIn] = useState(0);
  const [openFor, setOpenFor] = useState(6);

  const strategyId = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const rp = rpForStrategy(strategyId); // 0 · 1 · 2 · 3 — real
  const posture = strategyId ? STRATEGY_BY_ID[strategyId] : null;

  // GP — real data: the place's google aggregates through the live curve.
  const gp = gpParts(place.google_review_count, place.google_stars_overall);

  const where = whereScore(km);
  const wait = waitScore(opensIn);
  const fit = fitScore(openFor);
  const when = whenScore(opensIn, openFor);
  const ic = where * when;

  const vector = useMemo(() => mockVector(place.id, 48), [place.id]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div
        role="status"
        className="border-amber-200/80 bg-amber-50 text-amber-950 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">Draft simulator — does not affect Swipe, Map, or Memo.</p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            GP and RP are real data — Google popularity and the live promo rates; ES and the
            moment are operator sliders. Global knobs live in{" "}
            <Link href="/scoring-config" className="font-semibold underline-offset-2 hover:underline">
              Scoring Config
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ── Scores — four lanes for this place ───────────────────────── */}
      <SectionCard
        icon={<Gauge className="h-4.5 w-4.5" />}
        tint="pink"
        title="Scores"
        subtitle="Four Lanes that never compete: {organic, inorganic} × {now, future}. Zero Match zeroes every Score — money can't buy irrelevance."
        action={<Pill>Draft model</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {LANES.map((lane) => (
            <LaneCard
              key={lane.id}
              lane={lane}
              score={laneScore(lane, { es, gp: gp.gp, rp, ic })}
              detail={
                (lane.lane === "organic"
                  ? `ES ${fmt(es, 0)} · GP ${fmt(gp.gp, 2)}`
                  : `ES ${fmt(es, 0)} · RP ${rp}`) +
                (lane.mode === "now" ? ` · IC ${fmt(ic, 2)}` : "")
              }
            />
          ))}
        </div>

        {/* ES — the gate */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <GroupLabel>ES · Embeddings Similarity — the gate on every Lane</GroupLabel>
            <span className="text-sm font-semibold tabular-nums">
              {fmt(es, 0)}/{ES_MAX}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={ES_MAX}
            step={1}
            value={es}
            onChange={(e) => setEs(Number(e.target.value))}
            className="accent-primary mt-2 w-full"
            aria-label="Embeddings Similarity score"
          />
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Always semantic — embeddings cosine, per query; never binary tags. One tier, no
            judge. Zero zeroes every lane.
          </p>
        </div>

        {/* GP — real data */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>GP · Google Popularity — live from this place&apos;s reviews</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              {gp.rating != null ? `${gp.rating}★` : "no rating"} ×{" "}
              {gp.reviews.toLocaleString("en-US")} reviews
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Smooth volume × quality — earned popularity, the organic lanes&apos; multiplier.
            {gp.floored
              ? " The cold-start floor is holding this place up (too few reviews for the curve to speak)."
              : " A 1★-farm can't raise it; a ≤3★ place at volume earns ≈ 0."}
          </p>
          <p className="mt-2 font-mono text-[11px]">
            {gp.floored
              ? `raw ${fmt(gp.raw, 2)} → floor → `
              : `volume ${fmt(gp.volume, 2)} × quality ${fmt(gp.quality, 2)} → `}
            <b>GP {fmt(gp.gp, 2)}</b>
          </p>
        </div>

        {/* The moment */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>IC · Intent Context — where × when · now-mode lanes only</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              where {fmt(where, 2)} × when {fmt(when, 2)} = {fmt(ic, 2)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Planning Saturday from the sofa, distance and hours are noise;
            choosing where to go in the next hour, they&apos;re most of the
            decision. Time resolves to 30-minute blocks.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Ctl
              label="Where · distance"
              read={`${km} km`}
              factor={`×${fmt(where, 2)}`}
              min={0}
              max={40}
              step={0.5}
              v={km}
              onChange={setKm}
              note={`Halves every ${CFG.distanceHalfKm} km.`}
            />
            <Ctl
              label="Wait · opens in"
              read={opensIn === 0 ? "open now" : `+${quantizeH(opensIn)} h`}
              factor={`×${fmt(wait, 2)}`}
              min={0}
              max={6}
              step={0.5}
              v={opensIn}
              onChange={setOpensIn}
              note={`Waiting ${CFG.waitHalfH} h halves it.`}
              warn={opensIn > 0}
            />
            <Ctl
              label="Fit · open for"
              read={openFor === 0 ? "closed" : `${quantizeH(openFor)} h`}
              factor={`×${fmt(fit, 2)}`}
              min={0}
              max={6}
              step={0.5}
              v={openFor}
              onChange={setOpenFor}
              note={`The visit needs ${CFG.sessionH} h.`}
              warn={fit < 1}
            />
          </div>
        </div>

        {/* RP — real data */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>RP · Rewards Promotions — live from this place&apos;s rates</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              {fmt(rp, 0)}/{RP_MAX}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Linear, so posture and relevance stay comparable — a sharply-matched
            Conservative place can still out-rank a loosely-matched Dominant one.
            Zero earns no paid placement: nothing to promote. Set on the Promos
            tab.
          </p>
          <div className="mt-2">
            <PostureLadder current={strategyId} />
          </div>
          {posture ? null : (
            <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
              These rates match no preset — custom or legacy, so the place
              isn&apos;t in the paid lane at all.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Semantic ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Braces className="h-4.5 w-4.5" />}
        tint="indigo"
        title="Semantic"
        subtitle="ES is never binary tags — the place is queried by meaning: its profile embedded as a vector, matched by cosine. Tags only enrich the text."
        action={<Pill>Mock — no vectors yet</Pill>}
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            {place.description ? (
              <p className="bg-muted/60 border-border/60 rounded-xl border px-4 py-3 text-sm leading-relaxed">
                {place.description}
              </p>
            ) : (
              <p className="text-muted-foreground bg-muted/60 border-border/60 rounded-xl border px-4 py-3 text-sm italic">
                No description yet — the Enricher writes this; until then there
                is nothing to embed.
              </p>
            )}
            {(place.tags?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(place.tags ?? []).slice(0, 12).map((t) => (
                  <span
                    key={t}
                    className={"rounded-full px-2.5 py-1 text-[11px] font-medium " + TINT_CHIP.indigo}
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="bg-muted/60 border-border/60 flex h-16 items-end gap-px overflow-hidden rounded-xl border px-3 pt-2">
              {vector.map((v, i) => (
                <span
                  key={i}
                  className="w-full rounded-t-sm bg-indigo-500/50"
                  style={{ height: `${8 + v * 84}%` }}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              48 of 1,536 dims, mocked from the place id — the real vector comes
              from embedding the text on the left.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-[11px] font-semibold">
      {children}
    </span>
  );
}

function LaneCard({ lane, score, detail }: { lane: Lane; score: number; detail: string }) {
  const organic = lane.lane === "organic";
  const tint = organic
    ? "border-sky-500/30 bg-sky-500/[0.04]"
    : "border-pink-500/30 bg-pink-500/[0.04]";
  const head = organic ? "text-sky-700" : "text-pink-700";
  return (
    <div className={"flex flex-col gap-2 rounded-2xl border p-4 " + tint}>
      <p className={"text-[10px] font-bold tracking-[0.14em] uppercase " + head}>
        {organic ? "Organic" : "Inorganic"} · {lane.mode}
      </p>
      <div className="flex items-end gap-2">
        <p className="font-display text-4xl leading-none font-semibold tracking-tight tabular-nums">
          {fmt(score)}
        </p>
        <p className="text-muted-foreground pb-0.5 text-xs">/ {lane.max}</p>
      </div>
      <Meter value={score / lane.max} />
      <p className="text-muted-foreground font-mono text-[10px] leading-snug">{detail}</p>
    </div>
  );
}

function Ctl({
  label,
  read,
  factor,
  min,
  max,
  step,
  v,
  onChange,
  note,
  warn,
}: {
  label: string;
  read: string;
  factor: string;
  min: number;
  max: number;
  step: number;
  v: number;
  onChange: (v: number) => void;
  note: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className={"text-sm font-semibold " + (warn ? "text-amber-700" : "")}>{read}</span>
        <span className="text-muted-foreground font-mono text-[11px]">{factor}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="accent-primary mt-1 w-full"
      />
      <p className="text-muted-foreground text-[10px] leading-snug">{note}</p>
    </div>
  );
}

/** The 0 · 1 · 2 · 3 posture ladder, current rung lit. */
function PostureLadder({ current }: { current: StrategyId | null }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STRATEGIES.map((s) => {
        const active = s.id === current;
        return (
          <div
            key={s.id}
            className={
              "flex flex-col items-center rounded-xl border px-2 py-2.5 text-center " +
              (active ? "border-pink-500/40 bg-pink-500/[0.07]" : "border-border/60 bg-muted/40")
            }
          >
            <p
              className={
                "font-display text-lg font-semibold tabular-nums " +
                (active ? "text-pink-700" : "text-muted-foreground")
              }
            >
              {RP_BY_STRATEGY[s.id]}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px] leading-tight">{s.name}</p>
          </div>
        );
      })}
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="bg-muted h-2 overflow-hidden rounded-full">
      <div
        className="from-primary h-full rounded-full bg-gradient-to-r to-pink-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
