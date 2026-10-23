// THE POST-GOOGLE WIPE — Discovery › General (`discovery_config.general`).
//
// Pato, 2026-08-29: "when searching from Google in Discovery, don't show
// unactive places. Only active places." So this runs on what comes BACK from
// a Google Places query — Autocomplete, Text Search, Nearby — and on the
// Mesita rows those results resolve to. EVERY LANE THAT QUERIES GOOGLE reads
// it: Fast, Deep, Map, and admin's suggest.
//
// ONE REVIEWS FLOOR (MESITA-2702): `map.googleMinReviews`, on Google rows
// only, on every pipeline. A Mesita row answers the Active half alone
// (`mesitaGate`); a Google row answers both (`googleGate`). Area applies its
// Google half itself, in `eligibleGoogleHits`.
//
// IT IS A FILTER, NOT A SIGNAL — it excludes, it never demotes. The Map box
// (`discovery_config.map`) keeps its own floors and stays Map-only; these two
// numbers are Discovery-wide, which is the whole reason they live on
// `general` rather than being copied into four boxes that could disagree.
//
// TWO SIDES OF THE SAME QUESTION, ONE ANSWER:
//   Google-only row — Google's `businessStatus` + `userRatingCount`.
//   Mesita row      — `business_state` + `google_review_count`.
// Before this module, on-Mesita rows were waved through ("they're already
// onboarded") and a place the operator had switched Active OFF still came
// back from search. That was the bug.
//
// UNKNOWN DOES NOT CLEAR THE GATE. A null business_state or a null review
// count fails whichever knob is on. Same reading as every Mesita floor: a
// floor asks a place to PROVE it clears the bar, and a place with nothing to
// show has not. It is also the only reading that makes "only active
// places" true rather than "active places, plus the ones we couldn't check".

import type { DiscoveryConfig, GeneralConfig } from "./discovery-config.ts";

/** What the gate asks: the stored Active switch plus a reviews floor. */
export type GeneralGate = GeneralConfig & { minReviews: number };

/** A Google row: Active + the one reviews floor. */
export function googleGate(cfg: Pick<DiscoveryConfig, "general" | "map">): GeneralGate {
  return { ...cfg.general, minReviews: cfg.map.googleMinReviews };
}

/** A Mesita row: Active alone. A review count never cuts a Mesita place. */
export function mesitaGate(general: GeneralConfig): GeneralGate {
  return { requireActive: general.requireActive, minReviews: 0 };
}

/** The subset of a PostgREST builder a WHERE-clause gate uses. Kept
 *  structural so it is testable without a client. */
export type FilterableQuery<T> = {
  eq: (col: string, val: unknown) => T;
  gte: (col: string, val: unknown) => T;
  lte: (col: string, val: unknown) => T;
};

/** The Pulsing state (`business_state`). Google's own label, verbatim. */
export const OPERATIONAL = "OPERATIONAL";

export type GeneralGateSignals = {
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | null. */
  businessStatus?: string | null;
  /** Google review count. `userRatingCount` on the wire, `google_review_count` on a row. */
  reviewCount?: number | null;
};

export function isOperational(state: unknown): boolean {
  return typeof state === "string" && state.trim() === OPERATIONAL;
}

/** The whole gate, for one place. */
export function clearsGeneralGate(
  general: GeneralGate,
  signals: GeneralGateSignals,
): boolean {
  if (general.requireActive && !isOperational(signals.businessStatus)) {
    return false;
  }
  if (general.minReviews > 0) {
    const n = signals.reviewCount;
    if (typeof n !== "number" || !Number.isFinite(n) || n < general.minReviews) {
      return false;
    }
  }
  return true;
}

/**
 * A PostgREST builder, structurally. EF clients carry no `Database` generic,
 * so an ADMIN client's inferred builder type blows TS's instantiation depth
 * the moment it rides a generic helper (the anon client is fine). Callers on
 * the admin client cast to this once, at the query boundary, and cast the
 * result back.
 */
export interface GeneralGateQuery extends FilterableQuery<GeneralGateQuery> {}

/**
 * The same gate as a WHERE clause, for the lanes that fetch their own rows.
 * Pushed into the query because a pool is capped before anything ranks: a
 * cut applied after the fetch does not narrow the catalog, it thins the page
 * the guest receives.
 */
export function applyGeneralGateQuery<T extends FilterableQuery<T>>(
  query: T,
  general: GeneralGate,
): T {
  let q = query;
  if (general.requireActive) q = q.eq("business_state", OPERATIONAL);
  // `gte` excludes nulls — the intended reading, stated at the top.
  if (general.minReviews > 0) q = q.gte("google_review_count", general.minReviews);
  return q;
}
