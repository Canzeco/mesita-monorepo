// Supabase Edge Function — admin-web-search-places
//
// Super-admin place search for the admin console's "Manage Single Place"
// place picker. Takes a free-text query and returns matching Mesita places
// (by display name / cached Google name / slug, or an exact id paste). The operator
// picks one, and the admin console then drives that place through the
// existing business-* EFs (super-admin bypass in _shared/auth.ts grants
// access regardless of project_members).
//
// Auth: caller's JWT email must be in public.super_admins.
// verify_jwt = true gates non-bearer callers at the gateway.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { isPaidPlan } from "../_shared/membership-enforcement-helpers.ts";
import {
  isPlacePromoting,
  placePromotingLevel,
} from "../_shared/place-promoting.ts";
import { isPlaceListed, isPlaceRequested, isPlaceSeeded } from "../_shared/place-status.ts";
import { PULSE_LABELS_IN_ORDER, PULSE_TOTAL } from "../_shared/pulse-pieces.ts";
import type { EnrichmentMap } from "../_shared/schema-catalog.ts";
import {
  mergePlaceRowsById,
  placeIdsMatchingNameHistory,
} from "../_shared/place-name-history.ts";

type Body = { query?: unknown; limit?: unknown; googlePlaceIds?: unknown };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const q = typeof bodyRes.body.query === "string" ? bodyRes.body.query.trim() : "";
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
  const limit =
    typeof bodyRes.body.limit === "number" && Number.isInteger(bodyRes.body.limit)
      ? Math.min(Math.max(bodyRes.body.limit, 1), googlePlaceIds.length > 0 ? 250 : 50)
      : googlePlaceIds.length > 0
      ? Math.min(googlePlaceIds.length, 250)
      : 25;

  // The catalog table is the PIPELINE in one row — seeded → active → listed →
  // enriching → enriched → verified → partner → promoting — plus two TRAILING
  // acceptance intent bits (mesita_pay · yums) that are not pipeline rungs.
  // Everything except the two id-scoped reads below lives on profiles, so no
  // join is required here.
  // google_place_id is the seeded spine; business_status is Google's
  // OPERATIONAL fact (Active); plan + the four rate columns + the
  // strike/pause fields are what isPlacePromoting weighs.
  // Keep as a single string literal so supabase-js can type the select.
  const cols =
    "id, slug, name, google_name, google_place_id, category, category_label, status, address, photos, zone, google_stars_overall, google_review_count, content_status, request_count, listing_type, plan, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, promo_paused_until, plan_forfeited_at, strike_count, last_strike_at, business_status, business_status_at, updated_at";
  let rows: Record<string, unknown>[] = [];

  if (googlePlaceIds.length > 0) {
    const { data, error } = await admin
      .from("profiles")
      .select(cols)
      .in("google_place_id", googlePlaceIds)
      .limit(limit);
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (q.length === 0) {
    // Empty query — browse recent places for the catalog landing state.
    const { data, error } = await admin
      .from("profiles")
      .select(cols)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (UUID_RE.test(q)) {
    // Exact id paste — return that one place.
    const { data, error } = await admin.from("profiles").select(cols).eq("id", q).maybeSingle();
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = data ? [data as Record<string, unknown>] : [];
  } else if (q.length < 2) {
    return json({ ok: false, error: "query must be at least 2 characters" }, 400);
  } else {
    // Free-text: match the display name OR the cached Google label OR the slug.
    // `name` is generated from mesita_name → google_name, so the first leg
    // already covers an operator override; the google_name leg is what still
    // finds a place by the Google string after an operator renamed it.
    // Strip characters that break the PostgREST or() grammar (comma / parens),
    // then escape LIKE wildcards so the remaining text matches literally.
    const safe = q.replace(/[,()"]/g, " ").trim();
    const escaped = safe.replace(/[%_\\]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    const [{ data, error }, historyIds] = await Promise.all([
      admin
        .from("profiles")
        .select(cols)
        .or(
          `name.ilike."${pattern}",google_name.ilike."${pattern}",slug.ilike."${pattern}"`,
        )
        .order("updated_at", { ascending: false })
        .limit(limit),
      placeIdsMatchingNameHistory(admin, pattern),
    ]);
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = (data ?? []) as Record<string, unknown>[];
    const have = new Set(
      rows.map((r) => typeof r.id === "string" ? r.id : "").filter(Boolean),
    );
    const missing = historyIds.filter((id) => !have.has(id));
    if (missing.length > 0) {
      const { data: extra, error: extraErr } = await admin
        .from("profiles")
        .select(cols)
        .in("id", missing);
      if (extraErr) {
        return json({ ok: false, error: `search_failed: ${extraErr.message}` }, 500);
      }
      rows = mergePlaceRowsById(
        rows as Array<Record<string, unknown> & { id: string }>,
        (extra ?? []) as Array<Record<string, unknown> & { id: string }>,
        limit,
      );
    }
    // Prefer Mesita-name hits ahead of google-only / slug hits (one row per id).
    const qLower = safe.toLowerCase();
    rows.sort((a, b) => {
      const aMesita = typeof a.name === "string" &&
        a.name.toLowerCase().includes(qLower);
      const bMesita = typeof b.name === "string" &&
        b.name.toLowerCase().includes(qLower);
      if (aMesita !== bMesita) return aMesita ? -1 : 1;
      return 0;
    });
  }

  // ── Two id-scoped reads for the flags that are NOT on profiles. ──
  //
  // ENRICHED is the PULSE high-water, 0-10, folded from place_enrichment_events
  // by pulseHighWater. There used to be a SECOND enriched number here — a 0-3
  // stage level off place_research — and the two disagreed on every row: the
  // chip read one, the detail prose read the other (MESITA-1218). One fact,
  // one table, one number. The place_research read went with it: computing
  // that level was its only purpose here.
  //
  // VERIFIED is ownership proof — an approved project_verifications row. It
  // used to read `listing_type === "partner"`, which is the partner badge and
  // a different fact entirely (MESITA-1152).
  const ids = rows.map((v) => String(v.id)).filter(Boolean);

  const verified = new Set<string>();
  // MESITA-1249: enrichment is READ, not folded — pulseHighWater/
  // pulseBlockedAt already ran once, at write time, in pulse-report.ts.
  // `places`, not `profiles`: this jsonb blob is deliberately NOT in the
  // profiles view's column list (same reasoning as details/google_reviews/
  // popular_times staying out of PLACE_CARD_COLUMNS, MESITA-1283) — adding
  // it there means rebuilding the view + its two INSTEAD OF triggers, a
  // documented recurring pain point, for a field only two admin EFs need.
  const enrichment = new Map<string, EnrichmentMap>();
  const acceptance = new Map<string, { mesitaPay: boolean; yums: boolean }>();
  if (ids.length > 0) {
    const [verificationRes, enrichmentRes] = await Promise.all([
      admin
        .from("project_verifications")
        .select("place_id")
        .eq("status", "approved")
        .in("place_id", ids),
      // The two acceptance intent bits ride the same places-direct read:
      // admin-only columns, deliberately NEVER added to the profiles view
      // (the view is SELECT-granted to the anon key, so a view column is
      // publicly enumerable — and rebuilding it + its INSTEAD OF triggers
      // is the documented pain this side-read exists to avoid).
      admin.from("places").select("id, enrichment, mesita_pay_enabled, yums_enabled").in(
        "id",
        ids,
      ),
    ]);
    // Best-effort: a flag lookup must never 500 the catalog. A failed read
    // degrades to 0 / not-verified, which reads as "less done than it is" —
    // the safe direction for a status column.
    if (verificationRes.error) {
      console.error("[search-places] project_verifications:", verificationRes.error.message);
    }
    for (const v of (verificationRes.data ?? []) as Record<string, unknown>[]) {
      verified.add(String(v.place_id));
    }
    // Same best-effort posture: a missing/null row simply falls back to the
    // CREATED-floor default below.
    if (enrichmentRes.error) {
      console.error("[search-places] places.enrichment:", enrichmentRes.error.message);
    }
    for (const r of (enrichmentRes.data ?? []) as Record<string, unknown>[]) {
      if (r.enrichment) enrichment.set(String(r.id), r.enrichment as EnrichmentMap);
      // Missing row / failed read → the map stays empty and the shaped row
      // falls back to false below — the safe direction for an acceptance bit.
      acceptance.set(String(r.id), {
        mesitaPay: r.mesita_pay_enabled === true,
        yums: r.yums_enabled === true,
      });
    }
  }
  const EMPTY_ENRICHMENT: EnrichmentMap = { functions: {}, highWater: 0, blockedAt: null };

  // Trim photos to the first thumbnail to keep the payload small.
  // `name` is the generated display column (mesita_name → google_name); the
  // table now shows google_name specifically, so both ride along.
  const places = rows.map((v) => {
    const id = String(v.id);
    const contentStatus = (v.content_status as string | null) ?? null;
    const listingType = (v.listing_type as string | null) ?? null;
    const label = String(v.name ?? "");
    return {
      id: v.id,
      slug: v.slug,
      name: label,
      google_place_id: (v.google_place_id as string | null) ?? null,
      google_name: (v.google_name as string | null) ?? null,
      category: v.category,
      category_label: v.category_label,
      status: v.status,
      address: v.address,
      zone: (v.zone as string | null) ?? null,
      google_stars_overall:
        typeof v.google_stars_overall === "number" ? v.google_stars_overall : null,
      google_review_count:
        typeof v.google_review_count === "number" ? v.google_review_count : null,
      content_status: contentStatus,
      request_count: Number(v.request_count) || 0,
      listing_type: listingType,
      // The ten status facts, in table order (plus promoting_level below).
      seeded: isPlaceSeeded(v.google_place_id),
      // Google's OPERATIONAL fact — a FLAG, never a visibility gate.
      // NULL is silence, not "not operational".
      business_status: (v.business_status as string | null) ?? null,
      business_status_at: (v.business_status_at as string | null) ?? null,
      // The Listed fact. No extra read — `status` is already selected.
      listed: isPlaceListed(v.status),
      requested: isPlaceRequested({
        requestCount: v.request_count,
        contentStatus: contentStatus,
      }),
      // PULSE: how far the TEN-function ENRICH queue got, 0-10
      // (MESITA-1253). Not a count of functions that worked — the index of
      // the last function such that it and everything before it completed.
      // 0 is the CREATED floor; create stamps pulse+details, so a healthy
      // fresh place reads 2.
      enrich_pulse: (enrichment.get(id) ?? EMPTY_ENRICHMENT).highWater,
      enrich_pulse_total: PULSE_TOTAL,
      // The function NAMES ride with the number so the client renders what the
      // server counted. Indexed BY FUNCTION NUMBER — labels[0] is the
      // CREATED floor label — so a
      // client reads labels[level] with no off-by-one. web-admin used to keep its own positional copy of this
      // list with no shared import and no test, so a reorder would have put the
      // wrong name beside every row (MESITA-1222).
      enrich_pulse_labels: PULSE_LABELS_IN_ORDER,
      // WHY it stopped, not just where. The number alone is ambiguous, and
      // MESITA-1243 made that bite at 0: function 1 now fails a place Google
      // reports permanently closed, so 0 means both "seeded, nothing tried"
      // and "we asked, and the listing is dead". Shipped from the same events
      // the high-water walks, so the two cannot disagree.
      enrich_pulse_blocked: (enrichment.get(id) ?? EMPTY_ENRICHMENT).blockedAt,
      verified: verified.has(id),
      partner: isPaidPlan((v.plan as string | null) ?? null),
      promoting: isPlacePromoting(v as Parameters<typeof isPlacePromoting>[0]),
      // HOW HARD, 0-3 (zero · conservative · aggressive · dominant). Agrees
      // with the boolean above by construction: 0 exactly when it is false.
      promoting_level: placePromotingLevel(
        v as Parameters<typeof placePromotingLevel>[0],
      ),
      // Settlement acceptance INTENT BITS (places.mesita_pay_enabled /
      // places.yums_enabled) — stored, unwritable at the place-doc door,
      // false fleet-wide until their engines land (Pato gate 2026-08-29).
      mesita_pay: (acceptance.get(id) ?? { mesitaPay: false }).mesitaPay,
      yums: (acceptance.get(id) ?? { yums: false }).yums,
      photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
    };
  });

  return json({ ok: true, places });
});
