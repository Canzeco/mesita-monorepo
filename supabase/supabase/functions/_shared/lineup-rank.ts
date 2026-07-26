// Lineup ranker — score a place pool with the live scoring_config blob
// and merge Organic → Inorganic (MESITA-718; Hybrid removed 2026-07-22).

import { haversineKm } from "./geo.ts";
import { localClock } from "./local-time.ts";
import { parseVector, cosineSim } from "./embeddings-vector.ts";
import { buildOpennessArray } from "./lineup-openness.ts";
import { postureForRates, ratesFromPlace } from "./lineup-posture.ts";
import {
  composeFinalDeck,
  DEFAULT_MANUAL_PRIORITY,
  emScore,
  gpScore,
  LANES,
  laneScore,
  rpScore,
  smScore,
  type LaneId,
  type ScoringSettings,
  unitDraw,
  xxScore,
  type DeckCandidate,
} from "./lineup-scoring.ts";

export type LineupPlace = {
  id: string;
  lat: number | null;
  lng: number | null;
  listing_type: "partner" | "web" | string;
  hours: unknown;
  embedding: unknown;
  google_review_count?: number | null;
  google_stars_overall?: number | null;
  /** MP subscore — operator priority [0,1]; unset → DEFAULT_MANUAL_PRIORITY. */
  manual_priority?: number | null;
  [key: string]: unknown;
};

export type LineupContext = {
  /** Consumer lat/lng for SM where; null → where 1. */
  lat: number | null;
  lng: number | null;
  /** Seed for XX draws — request-stable (e.g. caller + rounded lat/lng). */
  xxSeed: string;
  /** Optional consumer distance tolerance km; null → blob defaultTolKm. */
  tolKm?: number | null;
};

/** Cosine per place id (−1 = missing embedding). */
export function cosineById(
  places: readonly LineupPlace[],
  queryVec: number[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of places) {
    const v = parseVector(p.embedding);
    m.set(p.id, v ? cosineSim(v, queryVec) : -1);
  }
  return m;
}

/**
 * Score the pool with Lineup v12 and return place ids in merge order.
 * The paid lane (inorganic) only admits listing_type === "partner".
 */
export function lineupOrderIds(
  places: readonly LineupPlace[],
  cosine: Map<string, number>,
  settings: ScoringSettings,
  ctx: LineupContext,
): string[] {
  const clock = localClock(ctx.lng);
  const day = clock?.weekday ?? "friday";
  // Quantize to the 30-min grid (hour + 0 or 0.5).
  const hour = clock
    ? clock.hour + (clock.minutes % 60 >= 30 ? 0.5 : 0)
    : 18;

  const candidates: DeckCandidate[] = places.map((p) => {
    const em = emScore(cosine.get(p.id) ?? -1);
    const km = ctx.lat != null && ctx.lng != null && p.lat != null && p.lng != null
      ? haversineKm(ctx.lat, ctx.lng, p.lat, p.lng)
      : null;
    const openness = buildOpennessArray(
      p.hours as Parameters<typeof buildOpennessArray>[0],
      day,
      hour,
    );
    const sm = smScore({
      km,
      tolKm: ctx.tolKm ?? null,
      zoneMode: false,
      openness: openness.bits,
      hoursUnknown: openness.unknown,
      whatRel: "none", // filters not on the EF yet
      sm: settings.sm,
    });
    const gp = gpScore(
      p.google_review_count as number | null | undefined,
      p.google_stars_overall as number | null | undefined,
      settings.gp,
    );
    const isPartner = p.listing_type === "partner";
    const posture = isPartner ? postureForRates(ratesFromPlace(p)) : null;
    // Non-members never enter paid lanes (lane filter, not a whisper score).
    const rp = isPartner ? rpScore(posture, settings.rp) : 0;
    // MP — the operator's per-place priority; unset → the 0.1 baseline.
    const mpRaw = Number(p.manual_priority);
    const mp = Number.isFinite(mpRaw) ? mpRaw : DEFAULT_MANUAL_PRIORITY;

    const scores = {} as Record<LaneId, number>;
    for (const lane of LANES) {
      const xx = xxScore(unitDraw(ctx.xxSeed, p.id, lane.id), settings.xx.control);
      const subs = { em, sm, gp, rp, xx, mp };
      // Paid lanes: force 0 for non-partners even if RP whisper would be >0.
      if (lane.id === "inorganic" && !isPartner) {
        scores[lane.id] = 0;
      } else {
        scores[lane.id] = laneScore(lane, subs);
      }
    }
    return { id: p.id, scores };
  });

  return composeFinalDeck(candidates, settings.laneN).slots.map((s) => s.id);
}

/** Places in Lineup merge order only (capped by laneN — no backfill). */
export function lineupReorder<T extends LineupPlace>(
  places: readonly T[],
  cosine: Map<string, number>,
  settings: ScoringSettings,
  ctx: LineupContext,
): T[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const ordered: T[] = [];
  for (const id of lineupOrderIds(places, cosine, settings, ctx)) {
    const p = byId.get(id);
    if (p) ordered.push(p);
  }
  return ordered;
}
