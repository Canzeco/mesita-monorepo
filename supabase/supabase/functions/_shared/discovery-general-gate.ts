// THE POST-GOOGLE WIPE — Discovery › General (`discovery_config.general`).
//
// Pato, 2026-08-29: "when searching from Google in Discovery, don't show
// unactive places. Only active places." So this runs on what comes BACK from
// a Google Places query — Autocomplete, Text Search, Nearby — and on the
// Mesita rows those results resolve to. EVERY LANE THAT QUERIES GOOGLE reads
// it: Fast, Deep, Map, and the business/admin suggest merge.
//
// It is not every MODE, and the difference has bitten a reader already.
// Catalog, Swipe and the Pay / Home / bbox branch of list-places draw from
// the listed Mesita pool and never call Google, so there is nothing here for
// them to wipe; `discovery_config.filters` is their floor. list-places gates
// this behind `if (isNearby)` on purpose and says so at the call site.
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
// count fails whichever knob is on. Same reading as `applyDiscoveryFilters`:
// a floor asks a place to PROVE it clears the bar, and a place with nothing
// to show has not. It is also the only reading that makes "only active
// places" true rather than "active places, plus the ones we couldn't check".

import type { GeneralConfig } from "./discovery-config.ts";
import type { FilterableQuery } from "./discovery-filters.ts";

/** The State-box fact `active`. Google's own label, verbatim. */
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

/** True when either knob is doing work — callers skip the fetch when not. */
export function generalGateActive(general: GeneralConfig): boolean {
  return general.requireActive || general.minReviews > 0;
}

/** The whole gate, for one place. */
export function clearsGeneralGate(
  general: GeneralConfig,
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

/** A Mesita row, by its column names. Same gate, different key spelling. */
export function rowClearsGeneralGate(
  general: GeneralConfig,
  row: {
    business_state?: string | null;
    google_review_count?: number | null;
  },
): boolean {
  return clearsGeneralGate(general, {
    businessStatus: row.business_state ?? null,
    reviewCount: row.google_review_count ?? null,
  });
}

/**
 * A PostgREST builder, structurally. EF clients carry no `Database` generic,
 * so an ADMIN client's inferred builder type blows TS's instantiation depth
 * the moment it rides a generic helper (the anon client is fine — that is why
 * `applyDiscoveryFilters` never hit this). Callers on the admin client cast
 * to this once, at the query boundary, and cast the result back.
 */
export interface GeneralGateQuery extends FilterableQuery<GeneralGateQuery> {}

/**
 * The same gate as a WHERE clause, for the listed lanes that fetch their own
 * rows. Pushed into the query so a capped pool is not thinned after the fact
 * (the rule `discovery-filters.ts` states and this module keeps).
 */
export function applyGeneralGateQuery<T extends FilterableQuery<T>>(
  query: T,
  general: GeneralConfig,
): T {
  let q = query;
  if (general.requireActive) q = q.eq("business_state", OPERATIONAL);
  // `gte` excludes nulls — the intended reading, stated at the top.
  if (general.minReviews > 0) q = q.gte("google_review_count", general.minReviews);
  return q;
}
