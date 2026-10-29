"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { enrichmentView, isEnrichedPlace } from "@/lib/place-enriched";
import { type ReviewFoundFlags, reviewFoundFlags } from "@/lib/review-found";

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
  /** The Mesita name (MESITA-2828). */
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
  content_state: string | null;
  // ── The state facts (labels: Created · Pulsing · Enriching · Enriched ·
  //    Disabled). All derived (or
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
  /** Guest request count — enrich threshold only; not shown in state tables. */
  request_count: number;
  /** Enricher pipeline mid-flight (content_state generating). */
  enriching: boolean;
  /** THE Enriched fact (MESITA-2154): an Enrich run completed —
   *  `enriched_at` set, shipped by the EF as `enriched`. Never the
   *  high-water below, never content_state: a Created place is not enriched. */
  enriched: boolean;
  /** When the last Enrich run completed; null for a Created place. */
  enriched_at: string | null;
  /** Premier (MESITA-2925, was Boost — MESITA-2809): the paid tier,
   *  0 · 1 · 2 = Off · 2X · 5X. Null when the payload does not
   *  carry it. */
  boost_tier?: number | null;
  /** Unique members who viewed / liked (saved) it. Null = not read. */
  viewed?: number | null;
  saved?: number | null;
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
} & ReviewFoundFlags;

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
    ...reviewFoundFlags(raw),
    content_state: contentState,
    ...enrichmentView({ ...raw, content_state: contentState }),
    enriched_at: typeof raw.enriched_at === "string" ? raw.enriched_at : null,
    boost_tier: typeof raw.boost_tier === "number" ? raw.boost_tier : null,
    viewed: typeof raw.viewed === "number" ? raw.viewed : null,
    saved: typeof raw.saved === "number" ? raw.saved : null,
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
 *  on. Unlisting removes the place from browse, search, and any shared link
 *  at once. Its own admin door (admin-web-set-place-listed). */
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
// were retired with the business console (MESITA-2090). Google's business
// status is display-only. Disable is the operator write
// (admin-web-set-place-listed).

/** Soft delete: writes places.state = 'archived' — the terminal value
 *  admin-web-set-place-listed's own header reserves for this. Reversible
 *  only by a direct DB edit, never by any UI action, which is the whole
 *  point of the distinct state from 'paused' (a List/Unlist toggle). */
export async function deletePlace(placeId: string): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-delete-place", { placeId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// ── Enrich ───────────────────────────────────────────────────────────────

// Start enrichment. One place starts enrich single place. A list starts
// enrich multiple places once, and Render decides how many run at once.
// The row reports the start, not the finish. There is one Enrich
// (MESITA-2799): the whole pipeline, replacing what it finds.
export async function enrichPlaces(placeIds: string[]): Promise<Result<true>> {
  const ids = placeIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Missing placeId" };
  const r = await efInvoke<{ enrichmentTriggered: boolean }>(
    "admin-web-enrich-place",
    ids.length === 1 ? { projectId: ids[0] } : { placeIds: ids },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

export async function enrichPlace(placeId: string): Promise<Result<true>> {
  return enrichPlaces([placeId]);
}

// ── Update (Google factuals; the hero while the gallery is one photo, MESITA-2794) ──

export async function updatePlaceGoogle(placeId: string): Promise<Result<true>> {
  const id = placeId.trim();
  if (!id) return { ok: false, error: "Missing placeId" };
  const r = await efInvoke<{ updatedAt: string }>("admin-web-update-place-google", {
    placeId: id,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

export async function updatePlacesGoogle(placeIds: string[]): Promise<Result<true>> {
  const ids = placeIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Missing placeId" };
  for (const id of ids) {
    const one = await updatePlaceGoogle(id);
    if (!one.ok) return one;
  }
  return { ok: true, data: true };
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
  mode: "fast",
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
  opts: {
    /** The create an OPEN caused (a Google-only row's name on Find): the EF
     *  gates it on Creation › "Create the profile on open · admin app". */
    onOpen?: boolean;
  } = {},
): Promise<CreatePlaceResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreatePlaceResponse>("admin-web-create-place", {
    placeId: id,
    ...(opts.onOpen ? { onOpen: true } : {}),
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

// ── Batches (Multiple Places, MESITA-3085) ───────────────────────────────
// The browser runs server actions ONE AT A TIME, so a box that fans out one
// action per row runs its rows in series however it awaits them. Each box
// run is therefore ONE action that calls every edge function at once and
// returns one result per id. Render, not this page, decides how many
// enrichments run together.

/** The most places one Enrich start carries: ENRICH_MAX_PLACES in
 *  supabase/functions/_shared/enrich-start.ts, which refuses the whole call
 *  past it. */
const ENRICH_CHUNK = 50;

function thrown(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}

/** Create every Google Place ID at once. Keyed by the Google Place ID. */
export async function createPlacesFromGooglePlaceIds(
  googlePlaceIds: string[],
): Promise<Record<string, CreatePlaceResult>> {
  const rows = await Promise.all(
    googlePlaceIds.map(async (id) => {
      const r = await createPlaceFromGooglePlaceId(id).catch(
        (err: unknown): CreatePlaceResult => ({ ok: false, error: thrown(err) }),
      );
      return [id, r] as const;
    }),
  );
  return Object.fromEntries(rows);
}

/** Enable, Disable, Delete or Update Google every place at once. Keyed by
 *  the Mesita place id. */
export async function writePlaces(
  placeIds: string[],
  action: "list" | "unlist" | "delete" | "google-update",
): Promise<Record<string, Result<true>>> {
  const rows = await Promise.all(
    placeIds.map(async (id) => {
      const call =
        action === "google-update"
          ? updatePlaceGoogle(id)
          : action === "delete"
            ? deletePlace(id)
            : setPlaceListed(id, action === "list");
      const r = await call.catch(
        (err: unknown): Result<true> => ({ ok: false, error: thrown(err) }),
      );
      return [id, r] as const;
    }),
  );
  return Object.fromEntries(rows);
}

/** Start Enrich for every place: all chunks of ENRICH_CHUNK at once. Keyed
 *  by the Mesita place id; each id carries its own chunk's result. */
export async function enrichPlacesAll(
  placeIds: string[],
): Promise<Record<string, Result<true>>> {
  const chunks: string[][] = [];
  for (let i = 0; i < placeIds.length; i += ENRICH_CHUNK) {
    chunks.push(placeIds.slice(i, i + ENRICH_CHUNK));
  }
  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const r = await enrichPlaces(chunk).catch(
        (err: unknown): Result<true> => ({ ok: false, error: thrown(err) }),
      );
      return chunk.map((id) => [id, r] as const);
    }),
  );
  return Object.fromEntries(rows.flat());
}

// ── Premier (MESITA-3090) ────────────────────────────────────────────────
// Edit box › Premier 2X · Premier 5X · End Premier. One call per place
// through admin-web-grant-place-premier action "set", all at once like
// writePlaces. A refusal (a guest pays, guests waiting, a guest checking
// out, archived) comes back as a failed Result whose `code` names it.

export type PremierSet = {
  result: "granted" | "ended" | "already";
  ends_at: string | null;
  previous_tier: number | null;
  previous_ends_at: string | null;
};

/** Move every place to `tier` (0 none · 1 2X · 2 5X) for `months` (1..12;
 *  null for tier 0). Keyed by the Mesita place id. */
export async function setPlacesPremier(
  placeIds: string[],
  tier: 0 | 1 | 2,
  months: number | null,
): Promise<Record<string, Result<PremierSet>>> {
  const rows = await Promise.all(
    placeIds.map(async (id) => {
      const r: Result<PremierSet> = await efInvoke<PremierSet & { ok: true }>(
        "admin-web-grant-place-premier",
        { placeId: id, action: "set", tier, months },
      )
        .then((res): Result<PremierSet> =>
          res.ok
            ? {
                ok: true,
                data: {
                  result: res.data.result,
                  ends_at: res.data.ends_at ?? null,
                  previous_tier: res.data.previous_tier ?? null,
                  previous_ends_at: res.data.previous_ends_at ?? null,
                },
              }
            : { ok: false, error: res.error, code: res.code },
        )
        .catch((err: unknown): Result<PremierSet> => ({ ok: false, error: thrown(err) }));
      return [id, r] as const;
    }),
  );
  return Object.fromEntries(rows);
}
