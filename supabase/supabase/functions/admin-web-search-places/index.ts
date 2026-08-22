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
import { isPlacePromoting } from "../_shared/place-promoting.ts";
import { isPlaceSeeded, placeEnrichLevel } from "../_shared/place-pulse.ts";

type Body = { query?: unknown; limit?: unknown };

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
  const limit =
    typeof bodyRes.body.limit === "number" && Number.isInteger(bodyRes.body.limit)
      ? Math.min(Math.max(bodyRes.body.limit, 1), 50)
      : 25;

  // The catalog table is now the PIPELINE in one row (MESITA-1166): seeded →
  // enriched 0-3 → verified → partner → promoting. Everything except the two
  // id-scoped reads below lives on profiles, so no join is required here.
  // google_place_id is the seeded spine; plan + the four rate columns + the
  // strike/pause fields are what isPlacePromoting weighs.
  // Keep as a single string literal so supabase-js can type the select.
  const cols =
    "id, slug, name, google_name, google_place_id, category, category_label, status, address, photos, zone, google_stars_overall, google_review_count, content_status, listing_type, plan, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, promo_paused_until, plan_forfeited_at, strike_count, last_strike_at, updated_at";
  let rows: Record<string, unknown>[] = [];

  if (q.length === 0) {
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
    const { data, error } = await admin
      .from("profiles")
      .select(cols)
      .or(
        `name.ilike."${pattern}",google_name.ilike."${pattern}",slug.ilike."${pattern}"`,
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    rows = (data ?? []) as Record<string, unknown>[];
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
  // ENRICHED is a LEVEL, not a boolean, and the pipeline already tracks it:
  // place_research walks research → analysis → contents → done, and its two
  // payload columns are the evidence of how far a place got. Deriving it here
  // means no new column, no backfill, and no second source of truth to drift
  // (Pato ratified "pipeline stage reached", 2026-08-21).
  //
  // VERIFIED is ownership proof — an approved project_verifications row. It
  // used to read `listing_type === "partner"`, which is the partner badge and
  // a different fact entirely (MESITA-1152).
  const ids = rows.map((v) => String(v.id)).filter(Boolean);

  const research = new Map<string, { stage: string; gathered: boolean; analysis: boolean }>();
  const verified = new Set<string>();
  if (ids.length > 0) {
    const [researchRes, verificationRes] = await Promise.all([
      admin
        .from("place_research")
        .select("place_id, stage, gathered, analysis")
        .in("place_id", ids),
      admin
        .from("project_verifications")
        .select("project_id")
        .eq("status", "approved")
        .in("project_id", ids),
    ]);
    // Best-effort: a flag lookup must never 500 the catalog. A failed read
    // degrades to level 0 / not-verified, which reads as "less done than it
    // is" — the safe direction for a status column.
    if (researchRes.error) {
      console.error("[search-places] place_research:", researchRes.error.message);
    }
    for (const r of (researchRes.data ?? []) as Record<string, unknown>[]) {
      research.set(String(r.place_id), {
        stage: String(r.stage ?? ""),
        gathered: r.gathered != null,
        analysis: r.analysis != null,
      });
    }
    if (verificationRes.error) {
      console.error("[search-places] project_verifications:", verificationRes.error.message);
    }
    for (const v of (verificationRes.data ?? []) as Record<string, unknown>[]) {
      verified.add(String(v.project_id));
    }
  }

  // Trim photos to the first thumbnail to keep the payload small.
  // `name` is the generated display column (mesita_name → google_name); the
  // table now shows google_name specifically, so both ride along.
  const places = rows.map((v) => {
    const id = String(v.id);
    const contentStatus = (v.content_status as string | null) ?? null;
    const listingType = (v.listing_type as string | null) ?? null;
    const label = String(v.name ?? "");
    const level = placeEnrichLevel(research.get(id), contentStatus);
    return {
      id: v.id,
      slug: v.slug,
      name: label,
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
      listing_type: listingType,
      // The five status flags, in table order.
      seeded: isPlaceSeeded(v.google_place_id),
      enrich_level: level,
      /** Kept for callers that only need "is it done". */
      enriched: level === 3,
      verified: verified.has(id),
      partner: isPaidPlan((v.plan as string | null) ?? null),
      promoting: isPlacePromoting(v as Parameters<typeof isPlacePromoting>[0]),
      photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
    };
  });

  return json({ ok: true, places });
});
