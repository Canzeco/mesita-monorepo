"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Braces, Gauge } from "lucide-react";
import {
  RP_BY_STRATEGY,
  strategyForPlace,
  STRATEGIES,
  STRATEGY_BY_ID,
  type StrategyId,
} from "@/lib/business/strategies";
import {
  DEFAULT_POINT_TOL_KM,
  DEFAULT_SM_PARAMS as SM,
  fitScore,
  gpParts,
  laneFormula,
  laneScore,
  LANES,
  quantizeH,
  rpScore,
  waitScore,
  whereScore,
  type Lane,
  type LaneId,
} from "@/lib/business/scores";
import type { AdminPlace } from "../actions";
import { GroupLabel, SectionCard, TINT_CHIP } from "../ui";

// ════════════════════════════════════════════════════════════════════════
// Scores — this place's potency in the recommendation engines (Swipe · Map ·
// Memo). Admin-only: the whole console sits behind the super-admin gate.
//
// This file RENDERS the model (v10); the model, its knobs and the reasoning
// live in @/lib/business/scores (RP postures in ./strategies), and the
// global view is Lineup Config. Three lanes, one score each, all [0,1]:
//
//   Organic   EM · SM · GP · XX
//   Inorganic EM · SM · RP · XX
//   Hybrid    EM · SM · GP · RP · XX
//
// TWO subscores are real data here: GP (the place's google star mass) and RP
// (its live promo rates → posture → rung). There is no consumer and no query
// in an admin view, so EM and SM's inputs are operator controls — that is
// the nature of the surface, not a gap in it. XX is pinned to 1 (off): a
// per-card random draw has no meaning for a single place. This page uses the
// CODE defaults for the knobs — the saved blob binds the Lineup Config
// page, not this one.
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

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

export function ScoresSection({ place }: { place: AdminPlace }) {
  // The query and the consumer don't exist here, so these are controls.
  const [em, setEm] = useState(1);
  const [km, setKm] = useState(2);
  const [opensIn, setOpensIn] = useState(0);
  const [openFor, setOpenFor] = useState(6);

  const strategyId = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const rp = rpScore(strategyId); // [0,1] rung — real (code-default rungs)
  const posture = strategyId ? STRATEGY_BY_ID[strategyId] : null;

  // GP — real data: the place's google aggregates through the live curve.
  const gp = gpParts(place.google_review_count, place.google_stars_overall);

  // SM — where × when at the operator's inputs; what = 1 (nothing asked).
  const where = whereScore(km, DEFAULT_POINT_TOL_KM, SM.where.distExp);
  const wait = waitScore(opensIn, SM.when);
  const fit = fitScore(openFor, SM.when);
  const when = wait * fit;
  const sm = where * when;

  const subs = { em, sm, gp: gp.gp, rp, xx: 1 };

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
            GP and RP are real data — Google star mass and the live promo rates; EM and SM&apos;s
            inputs are operator sliders, XX is pinned to 1 (off). Global knobs live in{" "}
            <Link href="/lineup-config" className="font-semibold underline-offset-2 hover:underline">
              Lineup Config
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ── Scores — three lanes for this place ──────────────────────── */}
      <SectionCard
        icon={<Gauge className="h-4.5 w-4.5" />}
        tint="pink"
        title="Scores"
        subtitle="Three lanes that never compete — Organic (earned merit), Inorganic (bought), Hybrid (both). Every subscore is [0,1], so a lane score is too. Zero EM or SM zeroes every lane — money can't buy irrelevance."
        action={<Pill>Model v10</Pill>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {LANES.map((lane) => (
            <LaneCard
              key={lane.id}
              lane={lane}
              score={laneScore(lane, subs)}
              detail={lane.parts
                .map((p) =>
                  p === "em"
                    ? `EM ${fmt(em)}`
                    : p === "sm"
                      ? `SM ${fmt(sm)}`
                      : p === "gp"
                        ? `GP ${fmt(gp.gp)}`
                        : p === "rp"
                          ? `RP ${fmt(rp)}`
                          : "XX 1",
                )
                .join(" · ")}
            />
          ))}
        </div>

        {/* EM — the semantic gate */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <GroupLabel>EM · Embeddings Match — the semantic gate on every lane</GroupLabel>
            <span className="text-sm font-semibold tabular-nums">{fmt(em)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={em}
            onChange={(e) => setEm(Number(e.target.value))}
            className="accent-primary mt-2 w-full"
            aria-label="Embeddings Match score"
          />
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            max(0, cos) of the place vector against a consumer + intent vector — per query,
            never binary tags. Zero zeroes every lane.
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
            Total star mass, log-squashed — earned popularity, the organic lanes&apos;
            multiplier. Each ×e more star mass adds 0.1; no reviews → 0 (out of the organic
            lane).
          </p>
          <p className="mt-2 font-mono text-[11px]">
            star mass {gp.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })} → ln(1 +
            raw)/10 → <b>GP {fmt(gp.gp)}</b>
          </p>
        </div>

        {/* SM — the structured moment */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>SM · Structured Match — where × when (what = 1, nothing asked)</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">
              where {fmt(where)} × when {fmt(when)} = {fmt(sm)}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            The intent&apos;s structured asks against this place&apos;s facts. The consumer owns
            the tolerance (default {DEFAULT_POINT_TOL_KM} km) · doubling distance beyond it costs{" "}
            {Math.pow(2, SM.where.distExp).toFixed(0)}×. Time resolves to 30-minute blocks.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Ctl
              label="Where · distance"
              read={`${km} km`}
              factor={`×${fmt(where)}`}
              min={0}
              max={40}
              step={0.5}
              v={km}
              onChange={setKm}
              note={`Halves at ${DEFAULT_POINT_TOL_KM} km (the default tolerance).`}
            />
            <Ctl
              label="Wait · opens in"
              read={opensIn === 0 ? "open now" : `+${quantizeH(opensIn)} h`}
              factor={`×${fmt(wait)}`}
              min={0}
              max={6}
              step={0.5}
              v={opensIn}
              onChange={setOpensIn}
              note={`Two plateaus — floor ${SM.when.waitFloor}, never 0.`}
              warn={opensIn > 0}
            />
            <Ctl
              label="Fit · open for"
              read={openFor === 0 ? "closed" : `${quantizeH(openFor)} h`}
              factor={`×${fmt(fit)}`}
              min={0}
              max={6}
              step={0.5}
              v={openFor}
              onChange={setOpenFor}
              note={`The visit needs ${SM.when.sessionH} h.`}
              warn={fit < 1}
            />
          </div>
        </div>

        {/* RP — real data */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <GroupLabel>RP · Rewards Promotions — live from this place&apos;s rates</GroupLabel>
            <p className="text-muted-foreground font-mono text-[11px]">{fmt(rp)}</p>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
            Posture → rung in [0,1]. Only the spread between rungs matters — a sharply-matched
            Conservative place can still out-rank a loosely-matched Dominant one. Set on the
            Promos tab.
          </p>
          <div className="mt-2">
            <PostureLadder current={strategyId} />
          </div>
          {posture ? null : (
            <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
              These rates match no preset — custom or legacy, so RP lands on the zero rung.
            </p>
          )}
        </div>

        {/* Definitions footer */}
        <div className="text-muted-foreground border-border/60 mt-6 border-t pt-3 font-mono text-[10.5px] leading-relaxed">
          {LANES.map((l) => `${l.label} = ${laneFormula(l)}`).join("  ·  ")} · XX pinned 1 here
        </div>
      </SectionCard>

      {/* ── Semantic ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Braces className="h-4.5 w-4.5" />}
        tint="indigo"
        title="Semantic"
        subtitle="EM is never binary tags — the place is queried by meaning: its profile embedded as a vector, matched by cosine. Tags only enrich the text."
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
              48 of 1,536 dims, mocked from the place id — the real vector comes from OpenAI
              text-embedding-3-small over the text on the left.
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

const LANE_TINTS: Record<LaneId, { box: string; head: string }> = {
  organic: { box: "border-sky-500/30 bg-sky-500/[0.04]", head: "text-sky-700" },
  inorganic: { box: "border-pink-500/30 bg-pink-500/[0.04]", head: "text-pink-700" },
  hybrid: { box: "border-violet-500/30 bg-violet-500/[0.04]", head: "text-violet-700" },
};

function LaneCard({ lane, score, detail }: { lane: Lane; score: number; detail: string }) {
  const t = LANE_TINTS[lane.id];
  return (
    <div className={"flex flex-col gap-2 rounded-2xl border p-4 " + t.box}>
      <p className={"text-[10px] font-bold tracking-[0.14em] uppercase " + t.head}>
        {lane.label} · {laneFormula(lane)}
      </p>
      <div className="flex items-end gap-2">
        <p className="font-display text-4xl leading-none font-semibold tracking-tight tabular-nums">
          {score.toFixed(3)}
        </p>
        <p className="text-muted-foreground pb-0.5 text-xs">/ 1</p>
      </div>
      <Meter value={score} />
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

/** The 0.1 · 0.4 · 0.7 · 1.0 posture ladder, current rung lit. */
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
              {RP_BY_STRATEGY[s.id].toFixed(1)}
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
