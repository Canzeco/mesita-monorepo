import type { PlaceHit, SuggestHit } from "@/app/(app)/manage-multiple/actions";
import type { PlaceLite } from "@/lib/places-types";
import {
  CRENUP_STEPS,
  stepEnriches,
  type CrenupStepKey,
} from "@/lib/state-vocabulary";

// Single Place › Find draws ONE table for a name (MESITA-2124): every place
// either Google source returned, once, with a column per source saying
// where that source ranked it. This file is the pure half — which rows,
// in what order, with what text — so the table component only draws.
//
// A name is Google's alone (MESITA-2896): Autocomplete and Text Search. The
// catalogue is never searched by name (MESITA-2907); it only says which
// Google hits Mesita holds. A Google hit Mesita holds is that Mesita place; a place neither Google source returns is not found. Nearby
// is not one: it takes a point, not a name, and Map owns it.

export type FindSource = "autocomplete" | "text";

/** What a word search shows. The catalogue is the empty list, not a search.
 *  Autocomplete is not a column. Google is the deep search. `long` is what
 *  a screen reader says. */
export const WORD_RANK_COLUMNS: readonly {
  key: "text";
  label: string;
  short: string;
  long: string;
}[] = [{ key: "text", label: "Google", short: "Google", long: "Google" }];

/** The sources a name merges. The table draws WORD_RANK_COLUMNS. */
export const FIND_SOURCES: readonly {
  key: FindSource;
  label: string;
  short: string;
  long: string;
}[] = [
  { key: "autocomplete", label: "Autocomplete", short: "Autocomplete", long: "Google Autocomplete" },
  { key: "text", label: "Text Search", short: "Text", long: "Google Text Search" },
];

/** Agreement ties break on Text Search rank, then Autocomplete (D3). */
const TIE_ORDER: readonly FindSource[] = ["text", "autocomplete"];

/** Rows per page (MESITA-2335: 50, Previous · Next). */
export const FIND_PAGE_ROWS = 50;

/** Enrichment Steps columns: the Enrich pass, 1–8. Seed stays off. */
export const ENRICHMENT_COLUMNS = CRENUP_STEPS.filter((step) =>
  stepEnriches(step.flows),
);

/** What one Enrichment Steps cell says. `unknown` is a payload with no
 *  function map — never a confident no. */
export type EnrichmentMark = "yes" | "no" | "fail" | "unknown";

export function enrichmentMark(hit: PlaceHit, key: CrenupStepKey): EnrichmentMark {
  const map = hit.enrich_functions;
  if (map == null) return "unknown";
  const state =
    map[key]?.state ?? (key === "embedding" ? map.semantic?.state : undefined);
  if (state === "completed") return "yes";
  if (state === "failed") return "fail";
  return "no";
}

export type SourceResult<T> = { status: "ok"; data: T } | { status: "error"; error: string };

export type TextSearchResult = {
  places: PlaceLite[];
  /** The stored Google floors (map.minRating/minReviews, 0 = off) and the place
   *  types the backend applied, and what they hid. */
  minRating: number;
  minUserRatingCount: number;
  filteredOutCount: number;
  /** Non-null when the EF's Mesita join failed. */
  mesitaLookupError: string | null;
};

export type FindInputs = {
  /** The whole catalogue: which hits Mesita holds, and the name it shows
   *  them by (D16). Never matched against the query. */
  catalog: readonly PlaceHit[];
  autocomplete: SourceResult<SuggestHit[]>;
  text: SourceResult<TextSearchResult>;
};

export type FindRow = {
  /** Google Place ID, or `mesita:<id>` for a Mesita place without one. */
  key: string;
  googleId: string | null;
  /** The Mesita place id when this page knows it. */
  mesitaId: string | null;
  /** Mesita holds it — open, never Create. A Text Search join can say so
   *  without an id; opening then takes the identity lookup. */
  held: boolean;
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  /** Catalogue row when Mesita knows this place — drives the Profile and
   *  Enrichment columns. Null when Google-only or held only per Text Search's
   *  join without a catalogue row. */
  placeHit: PlaceHit | null;
  /** 1-based position in each source; null = that source missed it. */
  ranks: Record<FindSource, number | null>;
};

export type FindNote = { tone: "error" | "muted"; text: string };

export type FindResult = {
  rows: FindRow[];
  /** Sources that failed: their columns read "—" under a warning mark. */
  failed: FindSource[];
  notes: FindNote[];
};

type Draft = {
  key: string;
  googleId: string | null;
  mesitaId: string | null;
  heldByJoin: boolean;
  autocomplete: SuggestHit | null;
  text: PlaceLite | null;
  ranks: Record<FindSource, number | null>;
};

function rowKey(googleId: string | null | undefined, mesitaId: string | null | undefined): string | null {
  const g = googleId?.trim();
  if (g) return g;
  return mesitaId ? `mesita:${mesitaId}` : null;
}

/** The empty search: every catalogue place, in the order `listAllPlaces`
 *  already sorted (name). Ranks stay empty — those sources were not asked.
 *  `total` is the server's count; a short list says it hit the ceiling. */
export function catalogueList(places: readonly PlaceHit[], total: number): FindResult {
  const notes: FindNote[] = [];
  if (places.length > 0) {
    notes.push({ tone: "muted", text: "Mesita only. Google was not asked." });
  }
  if (total > places.length) {
    notes.push({
      tone: "muted",
      text: `Showing ${places.length.toLocaleString()} of ${total.toLocaleString()}. The rest are past the catalogue ceiling.`,
    });
  }
  return {
    rows: places.map((hit) => {
      const googleId = hit.google_place_id?.trim() || null;
      return {
        key: `mesita:${hit.id}`,
        googleId,
        mesitaId: hit.id,
        held: true,
        name: hit.name.trim() || "Unnamed place",
        address: hit.address ?? "",
        rating: hit.google_stars_overall,
        reviews: hit.google_review_count,
        placeHit: hit,
        ranks: { autocomplete: null, text: null },
      };
    }),
    failed: [],
    notes,
  };
}

export function mergeFindResults(input: FindInputs): FindResult {
  // Every key a draft answers to, and each draft once in first-seen order.
  const byKey = new Map<string, Draft>();
  const drafts: Draft[] = [];

  // Merge onto an existing draft by EITHER key — a Mesita row knows its
  // Google Place ID only when the place has one.
  function draftFor(googleId: string | null, mesitaId: string | null): Draft | null {
    const key = rowKey(googleId, mesitaId);
    if (!key) return null;
    const existing =
      byKey.get(key) ?? (mesitaId ? byKey.get(`mesita:${mesitaId}`) : undefined);
    if (existing) {
      if (googleId && !existing.googleId) existing.googleId = googleId;
      if (mesitaId && !existing.mesitaId) existing.mesitaId = mesitaId;
      byKey.set(key, existing);
      return existing;
    }
    const d: Draft = {
      key,
      googleId: googleId || null,
      mesitaId,
      heldByJoin: false,
      autocomplete: null,
      text: null,
      ranks: { autocomplete: null, text: null },
    };
    byKey.set(key, d);
    if (mesitaId) byKey.set(`mesita:${mesitaId}`, d);
    drafts.push(d);
    return d;
  }

  if (input.autocomplete.status === "ok") {
    input.autocomplete.data.forEach((hit, i) => {
      const d = draftFor(hit.placeId || null, hit.mesitaId ?? null);
      if (!d || d.ranks.autocomplete != null) return;
      d.ranks.autocomplete = i + 1;
      d.autocomplete = hit;
    });
  }
  if (input.text.status === "ok") {
    input.text.data.places.forEach((place, i) => {
      const d = draftFor(place.id, null);
      if (!d || d.ranks.text != null) return;
      d.ranks.text = i + 1;
      d.text = place;
      if (place.existsInMesita) d.heldByJoin = true;
    });
  }

  const byGoogleId = new Map<string, PlaceHit>();
  const byId = new Map<string, PlaceHit>();
  for (const p of input.catalog) {
    byId.set(p.id, p);
    if (p.google_place_id) byGoogleId.set(p.google_place_id, p);
  }

  // Array#sort is stable, so equal rows keep first-seen order.
  const rows = drafts.map((d) => toRow(d, byGoogleId, byId)).sort(compareRows);

  const failed: FindSource[] = [];
  const notes: FindNote[] = [];
  for (const s of FIND_SOURCES) {
    const r = input[s.key];
    if (r.status === "error") {
      failed.push(s.key);
      notes.push({ tone: "error", text: `${s.long} failed: ${r.error}` });
    }
  }
  if (input.text.status === "ok") {
    const t = input.text.data;
    if (t.filteredOutCount > 0) {
      const floors = floorsLabel(t.minRating, t.minUserRatingCount);
      notes.push({
        tone: "muted",
        text: `Discovery's place rules hid ${t.filteredOutCount} Text Search result${t.filteredOutCount === 1 ? "" : "s"}${floors ? ` (${floors})` : ""}.`,
      });
    }
    if (t.mesitaLookupError) {
      notes.push({
        tone: "muted",
        text: `Text Search's Mesita lookup failed (${t.mesitaLookupError}); On Mesita reads the catalogue and Autocomplete only.`,
      });
    }
  }
  return { rows, failed, notes };
}

function toRow(
  d: Draft,
  byGoogleId: ReadonlyMap<string, PlaceHit>,
  byId: ReadonlyMap<string, PlaceHit>,
): FindRow {
  const record =
    (d.googleId ? byGoogleId.get(d.googleId) : undefined) ??
    (d.mesitaId ? byId.get(d.mesitaId) : undefined) ??
    null;
  const mesitaId = d.mesitaId ?? record?.id ?? null;
  const held = mesitaId != null || d.heldByJoin;
  const mesitaName = record?.name || "";
  const googleName = d.text?.displayName || d.autocomplete?.mainText || "";
  return {
    key: d.key,
    googleId: d.googleId,
    mesitaId,
    held,
    // D16: on Mesita the row says what Mesita calls it, else what Google does.
    name: (held ? mesitaName || googleName : googleName || mesitaName) || "Unnamed place",
    address:
      d.text?.formattedAddress ||
      record?.address ||
      d.autocomplete?.secondaryText ||
      "",
    rating: d.text?.rating ?? null,
    reviews: d.text?.userRatingCount ?? null,
    placeHit: record,
    ranks: d.ranks,
  };
}

/** D3: most sources first, then Text Search rank, then Autocomplete. A
 *  missing rank sorts after any present one. */
export function compareRows(a: FindRow, b: FindRow): number {
  const agreement = sourceCount(b) - sourceCount(a);
  if (agreement !== 0) return agreement;
  for (const s of TIE_ORDER) {
    const ra = a.ranks[s] ?? Number.POSITIVE_INFINITY;
    const rb = b.ranks[s] ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra < rb ? -1 : 1;
  }
  return 0;
}

export function sourceCount(row: FindRow): number {
  return FIND_SOURCES.reduce((n, s) => n + (row.ranks[s.key] != null ? 1 : 0), 0);
}

function floorsLabel(minRating: number, minUserRatingCount: number): string {
  const parts: string[] = [];
  if (minRating > 0) parts.push(`rating ≥ ${minRating}`);
  if (minUserRatingCount > 0) parts.push(`reviews ≥ ${minUserRatingCount.toLocaleString()}`);
  return parts.join(", ");
}

/** "4.7 · 266 reviews", or null without a rating. */
export function ratingLabel(row: Pick<FindRow, "rating" | "reviews">): string | null {
  if (row.rating == null) return null;
  return `${row.rating.toFixed(1)} · ${(row.reviews ?? 0).toLocaleString()} reviews`;
}
