// Supabase Edge Function — admin-web-search-places
//
// Super-admin place lookup for the admin console. Returns Mesita places by
// Google Place ID (Mesita Search's paste, the Write box, Manage Single
// Place); the admin console then drives a place through the admin-web-*
// place EFs.
//
// Two read modes, checked in this order: `all` (the WHOLE catalog, for
// Mesita Search's All places button) and `googlePlaceIds` (a paste). Both
// shape the same row.
//
// Auth: caller's JWT email must be in public.super_admins.
// verify_jwt = true gates non-bearer callers at the gateway.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
// The id-scoped side read below is walked in chunks: an ALL run can carry
// far more ids than a 250-id paste, and an `in` list rides in the URL.
import { chunked, ID_CHUNK } from "../_shared/postgrest.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  isPlaceEnriched,
  isPlaceListed,
  isPlaceRequested,
  isPlaceSeeded,
} from "../_shared/place-state.ts";
import {
  emptyReviewFound,
  type ReviewFoundFlags,
  reviewFoundFromRow,
} from "../_shared/review-found.ts";
import { CRENUP_LABELS_IN_ORDER, CRENUP_TOTAL } from "../_shared/crenup-ladder.ts";
import { fetchPlaceProfileStatsMany } from "../_shared/place-activity-stats.ts";
import {
  operatorFunctionStates,
  type EnrichmentMap,
  type FunctionState,
} from "../_shared/schema-catalog.ts";

type Body = {
  limit?: unknown;
  googlePlaceIds?: unknown;
  all?: unknown;
};

// ALL mode. PostgREST caps one response at db.max_rows (1000), so the whole
// catalog is walked in pages rather than asked for in a single limit. The
// ceiling is the honest stop: past it the run reports `total` and truncates,
// instead of shipping a payload the console cannot render.
const ALL_PAGE_SIZE = 500;
const ALL_MAX_ROWS = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  // ALL wins over the paste: it takes no input, so a stray paste alongside
  // it can only be leftover state from the last run.
  const all = bodyRes.body.all === true;
  const googlePlaceIds = Array.isArray(bodyRes.body.googlePlaceIds)
    ? [
      ...new Set(
        bodyRes.body.googlePlaceIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length >= 18),
      ),
    ].slice(0, 250)
    : [];
  // No input, no read: an empty body never meant "some places".
  if (!all && googlePlaceIds.length === 0) {
    return json({ ok: false, error: "googlePlaceIds or all is required" }, 400);
  }
  const limit =
    typeof bodyRes.body.limit === "number" && Number.isInteger(bodyRes.body.limit)
      ? Math.min(Math.max(bodyRes.body.limit, 1), 250)
      : Math.min(googlePlaceIds.length, 250);

  // The catalog table is the PIPELINE in one row — seeded → active → listed →
  // enriching → enriched. Everything except the id-scoped enrichment read
  // below lives on profiles, so no join is required here.
  // google_place_id is the seeded spine; business_state is Google's
  // OPERATIONAL fact (Active).
  // Keep as a single string literal so supabase-js can type the select.
  const cols =
    "id, slug, name, google_name, google_place_id, category, category_label, state, address, photos, zone, google_stars_overall, google_review_count, content_state, enriched_at, boost_tier, request_count, business_state, business_state_at, updated_at";
  let rows: Record<string, unknown>[] = [];
  // Only ALL mode reports it: a paste's count is the number of rows already
  // returned, and a second query would say nothing.
  let total: number | null = null;

  if (all) {
    // Page by id — unique, so a page boundary can neither drop nor repeat a
    // place the way a shared `updated_at` or `name` could. The label order
    // the operator reads is applied once, below, over the assembled set.
    const { count, error: countErr } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (countErr) return json({ ok: false, error: `search_failed: ${countErr.message}` }, 500);
    total = count ?? 0;
    let from = 0;
    while (from < ALL_MAX_ROWS) {
      const to = Math.min(from + ALL_PAGE_SIZE, ALL_MAX_ROWS) - 1;
      const { data, error } = await admin
        .from("profiles")
        .select(cols)
        .order("id", { ascending: true })
        .range(from, to);
      if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
      const page = (data ?? []) as Record<string, unknown>[];
      rows.push(...page);
      // Step by what CAME BACK, never by what was asked for. `db.max_rows`
      // can trim a page below ALL_PAGE_SIZE, and a fixed stride would then
      // skip exactly the rows the server trimmed — a silent hole in the
      // middle of a list whose whole promise is that it is complete.
      if (page.length === 0) break;
      from += page.length;
    }
    rows.sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
        sensitivity: "base",
      })
    );
  } else {
    const { data, error } = await admin
      .from("profiles")
      .select(cols)
      .in("google_place_id", googlePlaceIds)
      .limit(limit);
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = (data ?? []) as Record<string, unknown>[];
  }

  // ── One id-scoped read for the flag that is NOT on profiles. ──
  //
  // The CRENUP high-water (0-8, folded from place_enrichment_events by
  // crenupHighWater) is the completeness meter, NOT Enriched. Enriched is
  // `enriched_at` set (isPlaceEnriched, below; MESITA-2154).
  // There used to be a SECOND completeness number here — a 0-3
  // stage level off place_research — and the two disagreed on every row: the
  // chip read one, the detail prose read the other (MESITA-1218). One fact,
  // one table, one number. The place_research read went with it: computing
  // that level was its only purpose here.
  const ids = rows.map((v) => String(v.id)).filter(Boolean);

  // MESITA-1249: enrichment is READ, not folded — crenupHighWater/
  // crenupBlockedAt already ran once, at write time, in crenup-report.ts.
  // `places`, not `profiles`: this jsonb blob is deliberately NOT in the
  // profiles view's column list (same reasoning as details/google_reviews/
  // popular_times staying out of PLACE_CARD_COLUMNS, MESITA-1283) — adding
  // it there means rebuilding the view + its two INSTEAD OF triggers, a
  // documented recurring pain point, for a field only two admin EFs need.
  const enrichment = new Map<string, EnrichmentMap>();
  // Found flags live on place_profiles, not the profiles view. Same read as
  // the enrichment map so a catalog row can show the three Reviews states.
  const reviewFound = new Map<string, ReviewFoundFlags>();
  for (const idPart of chunked(ids, ID_CHUNK)) {
    const enrichmentRes = await admin
      .from("place_profiles")
      .select("id, enrichment, google_found, instagram_found, facebook_found")
      .in("id", idPart);
    // Best-effort: this lookup must never 500 the catalog. A failed read
    // or a missing/null row falls back to the CREATED-floor default below,
    // which reads as "less done than it is" — the safe direction for a state
    // column.
    if (enrichmentRes.error) {
      console.error("[search-places] places.enrichment:", enrichmentRes.error.message);
    }
    for (const r of (enrichmentRes.data ?? []) as Record<string, unknown>[]) {
      const id = String(r.id);
      if (r.enrichment) enrichment.set(id, r.enrichment as EnrichmentMap);
      reviewFound.set(id, reviewFoundFromRow(r));
    }
  }
  // Views · Likes (MESITA-2809): unique members per place_activity kind,
  // the same counts the place's Profile Stats box reads.
  const stats = await fetchPlaceProfileStatsMany(admin, ids);
  const EMPTY_ENRICHMENT: EnrichmentMap = { functions: {}, highWater: 0, blockedAt: null };

  // Trim photos to the first thumbnail to keep the payload small.
  // `name` is the Mesita name (MESITA-2828); the table also shows Google's
  // own label, so both ride along.
  const places = rows.map((v) => {
    const id = String(v.id);
    const contentState = (v.content_state as string | null) ?? null;
    const label = String(v.name ?? "");
    return {
      id: v.id,
      slug: v.slug,
      name: label,
      google_place_id: (v.google_place_id as string | null) ?? null,
      google_name: (v.google_name as string | null) ?? null,
      category: v.category,
      category_label: v.category_label,
      state: v.state,
      address: v.address,
      zone: (v.zone as string | null) ?? null,
      google_stars_overall:
        typeof v.google_stars_overall === "number" ? v.google_stars_overall : null,
      google_review_count:
        typeof v.google_review_count === "number" ? v.google_review_count : null,
      ...reviewFound.get(id) ?? emptyReviewFound(),
      content_state: contentState,
      request_count: Number(v.request_count) || 0,
      // The state facts, in table order.
      seeded: isPlaceSeeded(v.google_place_id),
      // Google's OPERATIONAL fact — a FLAG, never a visibility gate.
      // NULL is silence, not "not operational".
      business_state: (v.business_state as string | null) ?? null,
      business_state_at: (v.business_state_at as string | null) ?? null,
      // The Listed fact. No extra read — `state` is already selected.
      listed: isPlaceListed(v.state),
      requested: isPlaceRequested({
        requestCount: v.request_count,
        enrichedAt: v.enriched_at,
      }),
      // THE Enriched fact (MESITA-2154): an Enrich run completed —
      // `enriched_at` set. Create never stamps it, so a Created place is
      // `enriched: false` here whatever its content_state or high-water.
      enriched: isPlaceEnriched(v.enriched_at),
      enriched_at: (v.enriched_at as string | null) ?? null,
      // Official (MESITA-2925, was Boost MESITA-2809): the paid tier,
      // 0 · 1 · 2 · 3 = Off · 2X · 5X · 10X. Selected is no longer read.
      boost_tier: typeof v.boost_tier === "number" ? v.boost_tier : null,
      // Missing when the read failed — the table says "?", never a false 0.
      viewed: stats.get(id)?.viewed ?? null,
      saved: stats.get(id)?.saved ?? null,
      // CRENUP: how far the EIGHT-step ENRICH queue got, 0-8
      // (MESITA-1253). Not a count of functions that worked — the index of
      // the last function such that it and everything before it completed.
      // 0 is the seeded floor. Create stamps details (1), description (7)
      // and embedding (8) but never serp (2), and the walk stops at the
      // first gap — so a fresh Created place reads 1, stopped at serp. This
      // is the completeness meter, never the Enriched yes/no.
      enrich_crenup: (enrichment.get(id) ?? EMPTY_ENRICHMENT).highWater,
      enrich_crenup_total: CRENUP_TOTAL,
      // The function NAMES ride with the number so the client renders what the
      // server counted. Indexed BY FUNCTION NUMBER — labels[0] is the
      // CREATED floor label — so a
      // client reads labels[level] with no off-by-one. web-admin used to keep its own positional copy of this
      // list with no shared import and no test, so a reorder would have put the
      // wrong name beside every row (MESITA-1222).
      enrich_crenup_labels: CRENUP_LABELS_IN_ORDER,
      // WHY it stopped, not just where. The number alone is ambiguous, and
      // MESITA-1243 made that bite at 0: function 1 now fails a place Google
      // reports permanently closed, so 0 means both "seeded, nothing tried"
      // and "we asked, and the listing is dead". Shipped from the same events
      // the high-water walks, so the two cannot disagree.
      enrich_crenup_blocked: (enrichment.get(id) ?? EMPTY_ENRICHMENT).blockedAt,
      // The per-function map (MESITA-1611) — same fold web-business's
      // Places list and admin-web-get-overview already ship as
      // enrich_functions. The high-water above stops counting at the first
      // gap by design, so it alone cannot show a function that completed
      // AFTER an earlier one failed; this map can. OPTIONAL: guarded
      // because foldFunctionStateMap has no null check and throws on one.
      enrich_functions: (() => {
        const fnMap = (enrichment.get(id) ?? EMPTY_ENRICHMENT).functions;
        return fnMap && typeof fnMap === "object"
          ? operatorFunctionStates(fnMap as Partial<Record<string, FunctionState>>)
          : undefined;
      })(),
      photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
    };
  });

  // `total` is null outside ALL mode — see the declaration above.
  return json({ ok: true, places, total });
});
