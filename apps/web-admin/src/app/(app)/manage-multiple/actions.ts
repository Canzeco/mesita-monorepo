"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { enrichmentView, isEnrichedPlace } from "@/lib/place-enriched";

// ════════════════════════════════════════════════════════════════════════
// Places — a super-admin drives MANY places at once through the admin-* edge
// functions. The operator's JWT email is in super_admins, which is the whole
// gate _shared/auth.ts applies.
//
// These lived in the retired per-place admin console (`manage-single`) until
// it was deleted (MESITA-1588); this page was their only surviving caller, so
// they moved here. Single Place (MESITA-2084) imports them from here rather
// than owning a copy — ONE caller set, so the two pages cannot drift on what
// a button does. The per-place editor is Single Place (MESITA-2086); web-
// business was deleted in MESITA-2089.
// ════════════════════════════════════════════════════════════════════════

// `code` is the EF's machine-readable failure (efInvoke already keeps it off
// `body.code`). Optional because most call sites only ever show a sentence.
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string | null };

// ── Place search ─────────────────────────────────────────────────────────

/**
 * Why the enrichment queue stopped, straight off `crenupBlockedAt` in
 * `_shared/crenup-ladder.ts`. `failed` = the function ran and could not do its
 * job; `missing` = it has no event yet. The EF ships it beside the number,
 * because the number alone cannot tell those two apart at 0.
 */
export type CrenupBlock = {
  key: string;
  index: number;
  state: "failed" | "missing";
};

/** One Crenup function's state, as the EF's shared fold ships it (the same
 *  shape web-business's EnrichFunctionState had before MESITA-2089 deleted
 *  that app). */
export type EnrichFunctionState = {
  state: "pending" | "completed" | "failed";
  at: string | null;
  detail: string | null;
};

export type PlaceHit = {
  id: string;
  slug: string | null;
  /** Generated display label: coalesce(mesita_name, google_name). */
  name: string;
  /** Google's own label. The catalog table shows THIS, not `name`. */
  google_name: string | null;
  category: string | null;
  category_label: string | null;
  /** Families: Enricher-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  state: string | null;
  address: string | null;
  photo: string | null;
  zone: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  /** Reviews states. Yes when that source resolved. Display numbers stay
   *  off this type's state columns. */
  google_found: boolean;
  instagram_found: boolean;
  facebook_found: boolean;
  content_state: string | null;
  // ── The state facts (labels: Created · Pulsing · Disabled · Requested ·
  //    Enriching · Enriched). Bools except Requested (0…n). All derived (or
  //    projected) in admin-web-search-places, except Enriching which is
  //    content_state generating (MESITA-453 whole-pipeline). Disabled is
  //    `!listed`: the operator's off switch.
  /** Google Place ID spine — used to match a Mesita Search paste. */
  google_place_id: string | null;
  /** google_place_id present — the identity spine every run starts from. */
  seeded: boolean;
  /** A guest can reach it: places.state, per the consumer RLS policy. */
  listed: boolean;
  /** Derived has-demand for filters. Catalog State shows request_count. */
  requested: boolean;
  /** Guest request count — the Requested State fact, 0…n. */
  request_count: number;
  /** Enricher pipeline mid-flight (content_state generating). */
  enriching: boolean;
  /** THE Enriched fact (MESITA-2154): an Enrich run completed —
   *  `enriched_at` set, shipped by the EF as `enriched`. Never the
   *  high-water below, never content_state: a Created place is not enriched. */
  enriched: boolean;
  /** When the last Enrich run completed; null for a Created place. */
  enriched_at: string | null;
  /** Operating (MESITA-1239): Google's businessStatus, verbatim. NULL = Google
   *  is silent, which is a third state and not OPERATIONAL. A FLAG, never a
   *  visibility gate — Listed above is the gate. */
  business_state: string | null;
  /** When Operating was last observed. Without it a stale claim reads current. */
  business_state_at: string | null;
  /** CRENUP: how far the eight-step queue got, 0-8 — the completeness
   *  meter, not the Enriched yes/no. 0 means it never started — or the place
   *  predates piece reporting and has no events. A Created place reads 1. */
  enrich_crenup: number;
  /** The ladder's length, so nothing hardcodes 9. */
  enrich_crenup_total: number;
  /** The rung names in queue order, from the server. Never hand-copy this
   *  list — a reorder would put the wrong name beside every row. */
  enrich_crenup_labels: string[];
  /** Why the queue stopped where it did — null once it has finished. */
  enrich_crenup_blocked: CrenupBlock | null;
  /** The per-function map (MESITA-1611), keyed by Crenup function. Absent
   *  means the payload predates the field — the high-water above is still
   *  the fallback, and it alone cannot show a function that completed AFTER
   *  an earlier one failed, which is exactly the gap this map closes. */
  enrich_functions?: Record<string, EnrichFunctionState> | null;
};

// The search EF only guarantees id/name — every other field may be absent,
// hence the defensive `?? null` normalization below.
type RawPlaceHit = Pick<PlaceHit, "id" | "name"> & Partial<Omit<PlaceHit, "id" | "name">>;

function normalizePlaceHit(raw: RawPlaceHit): PlaceHit {
  const contentState = raw.content_state ?? null;
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: raw.name,
    google_name: raw.google_name ?? null,
    category: raw.category ?? null,
    category_label: raw.category_label ?? null,
    state: raw.state ?? null,
    address: raw.address ?? null,
    photo: raw.photo ?? null,
    zone: raw.zone ?? null,
    google_stars_overall:
      typeof raw.google_stars_overall === "number" ? raw.google_stars_overall : null,
    google_review_count:
      typeof raw.google_review_count === "number" ? raw.google_review_count : null,
    google_found: raw.google_found === true,
    instagram_found: raw.instagram_found === true,
    facebook_found: raw.facebook_found === true,
    content_state: contentState,
    ...enrichmentView({ ...raw, content_state: contentState }),
    enriched_at: typeof raw.enriched_at === "string" ? raw.enriched_at : null,
    google_place_id: raw.google_place_id ?? null,
    seeded: raw.seeded ?? false,
    listed: raw.listed ?? false,
    request_count:
      typeof raw.request_count === "number" && Number.isFinite(raw.request_count)
        ? raw.request_count
        : 0,
    requested:
      typeof raw.requested === "boolean"
        ? raw.requested
        : !isEnrichedPlace(raw) &&
          typeof raw.request_count === "number" &&
          raw.request_count > 0,
    business_state:
      typeof raw.business_state === "string" ? raw.business_state : null,
    business_state_at:
      typeof raw.business_state_at === "string" ? raw.business_state_at : null,
    enrich_crenup: raw.enrich_crenup ?? 0,
    // No `?? 9` here any more: the total and the labels come from the same
    // server list, so a client fallback could only ever disagree with it. The
    // label fallback subtracts one — the labels are indexed by function number
    // with the Created floor label at 0, so eleven of them describe a 0-10 scale.
    enrich_crenup_total: raw.enrich_crenup_total ??
      (raw.enrich_crenup_labels ? raw.enrich_crenup_labels.length - 1 : 0),
    enrich_crenup_labels: raw.enrich_crenup_labels ?? [],
    // No invented fallback: absent means the payload predates the field, and
    // defaulting to "missing" would claim a fact we did not read.
    enrich_crenup_blocked: raw.enrich_crenup_blocked ?? null,
    // Same posture: absent stays absent so the strip knows to fall back to
    // the high-water, rather than a fabricated empty map reading as "nothing
    // has run yet".
    enrich_functions: raw.enrich_functions ?? null,
  };
}

/** Mesita catalog lookup by Google Place IDs — read-only, no create/enrich. */
export async function searchPlacesByGoogleIds(
  googlePlaceIds: string[],
): Promise<Result<PlaceHit[]>> {
  const ids = googlePlaceIds.map((id) => id.trim()).filter((id) => id.length >= 18);
  if (ids.length === 0) return { ok: true, data: [] };
  const r = await efInvoke<{ places: RawPlaceHit[] }>("admin-web-search-places", {
    googlePlaceIds: ids.slice(0, 250),
    limit: Math.min(ids.length, 250),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: (r.data.places ?? []).map(normalizePlaceHit) };
}

/**
 * Every place on Mesita — no paste, no query. Mesita Search's All places
 * button. The EF walks the whole catalog server-side and ships `total`
 * beside the rows, so a run that hits its ceiling can say so instead of
 * reading as a short catalog.
 */
export async function listAllPlaces(): Promise<
  Result<{ places: PlaceHit[]; total: number }>
> {
  const r = await efInvoke<{ places: RawPlaceHit[]; total?: number | null }>(
    "admin-web-search-places",
    { all: true },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const places = (r.data.places ?? []).map(normalizePlaceHit);
  return {
    ok: true,
    data: {
      places,
      total: typeof r.data.total === "number" ? r.data.total : places.length,
    },
  };
}

// ── State writes ─────────────────────────────────────────────────────────
// Every setter is fire-and-check: the batch rows report ok/error and re-read
// the catalog afterwards, so none of them needs the place row back.

/** Listed is the guest-visibility gate: places.state, which is what the
 *  consumer RLS policy places_select_public_visible gates every guest read
 *  on. Unlisting removes the place from browse, search, the swipe deck and
 *  any shared link at once. Its own admin door (admin-web-set-place-listed). */
export async function setPlaceListed(
  placeId: string,
  listed: boolean,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-set-place-listed", {
    placeId,
    listed,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// Verified and Partnered are read-only here (MESITA-1664); their write doors
// were retired with the business console (MESITA-2090). Active is Single
// Place's switch (admin-web-set-place-active).

/** Soft delete: writes places.state = 'archived' — the terminal value
 *  admin-web-set-place-listed's own header reserves for this. Reversible
 *  only by a direct DB edit, never by any UI action, which is the whole
 *  point of the distinct state from 'paused' (a List/Unlist toggle). */
export async function deletePlace(placeId: string): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-delete-place", { placeId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// ── Crenup ───────────────────────────────────────────────────────────────

// Kept so existing callers still type-check. Render runs the whole enrichment.
export type ReenrichMode = "fill" | "full" | "second" | "third";

// Start enrichment. One place starts enrich single place. A list starts
// enrich multiple places once, and Render decides how many run at once.
// The row reports the start, not the finish.
export async function enrichPlaces(
  placeIds: string[],
  overwrite = false,
): Promise<Result<true>> {
  const ids = placeIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Missing placeId" };
  const r = await efInvoke<{ enrichmentTriggered: boolean }>(
    "admin-web-enrich-place",
    ids.length === 1
      ? { projectId: ids[0], overwrite }
      : { placeIds: ids, overwrite },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

export async function enrichPlace(
  placeId: string,
  _mode: ReenrichMode = "fill",
  _overwrite: string[] = [],
  overwrite = false,
): Promise<Result<true>> {
  return enrichPlaces([placeId], overwrite || _overwrite.length > 0);
}

// ── Name searches (Single Place › Find, MESITA-2116 · MESITA-2124) ───────

/** One row as admin-web-suggest-places ships it, in any mode. `placeId` is
 *  the Google Place ID (empty on a Mesita row that has none); `mesitaId`
 *  rides only a row resolved to — or drawn from — a Mesita place. */
export type SuggestHit = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  state: "not_in_mesita" | "web_listed" | "verified_partner_other" | "verified_partner_self";
  mesitaId?: string;
};

async function suggestPlacesIn(
  mode: "fast" | "mesita",
  input: string,
  sessionToken: string,
): Promise<Result<SuggestHit[]>> {
  const q = input.trim();
  if (q.length < 2) return { ok: true, data: [] };
  const r = await efInvoke<{ predictions: SuggestHit[] }>("admin-web-suggest-places", {
    input: q,
    sessionToken,
    mode,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.predictions ?? [] };
}

/** Google Places Autocomplete Search for a name — the lane's `fast` mode,
 *  Autocomplete alone. Discovery › General cuts it as it cuts every Google
 *  lane. */
export async function autocompleteGooglePlaces(
  input: string,
  sessionToken: string,
): Promise<Result<SuggestHit[]>> {
  return suggestPlacesIn("fast", input, sessionToken);
}

/** Mesita Places Name Search for a name — the lane's `mesita` mode: the
 *  name-embedding match over listed places that consumer Search runs, and
 *  no Google call. */
export async function searchMesitaNames(
  input: string,
  sessionToken: string,
): Promise<Result<SuggestHit[]>> {
  return suggestPlacesIn("mesita", input, sessionToken);
}

// ── Create (the Create box and Single Place) ─────────────────────────────
// Each Google Place ID runs through admin-web-create-place, which fetches
// Google data and persists the ugly profile (ready, not Enriched). Enricher is
// not queued — Enrich is a second call. Callers invoke this once per Place ID.

type CreatePlaceOk = {
  ok: true;
  placeId: string;
  name: string;
  /** Already on Mesita — the batch continues; this row was not re-created. */
  alreadyExisted: boolean;
  /** The create call enqueued async enrichment (Enricher cron pipeline). */
  enrichmentTriggered: boolean;
};
type CreatePlaceErr = { ok: false; error: string };
type CreatePlaceResult = CreatePlaceOk | CreatePlaceErr;

type CreatedPlace = {
  id?: string;
  name?: string;
};

type CreatePlaceResponse = {
  place?: CreatedPlace;
  enrichment?: {
    enrichmentTriggered?: boolean;
  };
};

type CreatePlaceErrorBody = {
  existing?: { id?: string; name?: string };
};

export async function createPlaceFromGooglePlaceId(
  placeId: string,
): Promise<CreatePlaceResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreatePlaceResponse>("admin-web-create-place", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate error responses carry an `existing` object.
    const body = (r.data ?? {}) as CreatePlaceErrorBody;
    if (r.status === 409 && r.code === "place_already_exists") {
      const existingId = body.existing?.id;
      if (!existingId) {
        return { ok: false, error: "This place is already on Mesita." };
      }
      return {
        ok: true,
        alreadyExisted: true,
        placeId: existingId,
        name: body.existing?.name ?? "(already on Mesita)",
        enrichmentTriggered: false,
      };
    }
    return { ok: false, error: r.error };
  }

  const place = r.data.place;
  if (!place?.id) return { ok: false, error: "No place returned" };
  return {
    ok: true,
    alreadyExisted: false,
    placeId: place.id,
    name: place.name ?? "(unnamed)",
    enrichmentTriggered: r.data.enrichment?.enrichmentTriggered ?? false,
  };
}
