// Supabase Edge Function — business-web-get-overview
//
// Authenticated. Returns *everything* the business / validator surfaces
// need for the active place in one round trip:
//   - the signed-in user (id + email)
//   - every place they're a member of (sidebar picker)
//   - the active place's full row + recent tickets
//
// Self-contained: own JWT verification, own DB reads via the service role,
// never calls another Edge Function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  checkSuperAdmin,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS as PLACE_COLUMNS } from "../_shared/place-columns.ts";
import { isPlaceListed, isPlaceRequested, isPlaceSeeded } from "../_shared/place-status.ts";
import { PULSE_LABELS_IN_ORDER, PULSE_TOTAL } from "../_shared/pulse-pieces.ts";
import type { EnrichmentMap, FunctionState } from "../_shared/schema-catalog.ts";
import { operatorFunctionStates } from "../_shared/schema-catalog.ts";

// Super-admin manage-single extra: the Embeddings card (MESITA-720). Keep it
// off the business overview payload; only elevate when the caller is a
// super-admin.
const PLACE_ADMIN_EMBEDDING_COLUMNS =
  ", embedding, embedding_source_hash, embedding_source_text, name_embedding, name_embedding_hash";

// Status (MESITA-1186). The place editor's Status box answers `seeded` off the
// identity spine, so the super-admin read needs the column. Admin-only for the
// same reason the embedding columns are: a business has no use for Google's id,
// and it must never widen PLACE_PUBLIC_COLUMNS.
const PLACE_ADMIN_STATUS_COLUMNS = ", google_place_id";

// `placeId` is the canonical place-row id key (MESITA-26); `activeUnitId` (legacy)
// is this EF's legacy alias, kept working during the client migration window.
type Body = {
  placeId?: string;
  /** @deprecated MESITA-26; prefer placeId (MESITA-942). */
  activeUnitId?: string;
  ticketsLimit?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;
  const userEmail = authRes.user.email;

  // Auth: any signed-in user. Super-admin elevation (skips project_members
  // and returns the requested place) is granted when the caller's email
  // is in public.super_admins.
  const admin = adminClient(envRes.env);
  const isSuperAdmin = await checkSuperAdmin(admin, authRes.user);

  const body = await readJsonOr<Body>(req, {});
  const requestedPlaceId = readPlaceIdAlias(body) || null;
  // 0 means "don't fetch tickets at all" — the sidebar layout doesn't need
  // them, only the active page does.
  const ticketsLimit = clampTicketsLimit(body.ticketsLimit);

  // Super-admin path: skip project_members. Require an explicit placeId
  // (legacy body keys projectId/activeUnitId still accepted via
  // readPlaceIdAlias; the link generator always supplies one) and return
  // a single-row list.
  type PlaceRow = Record<string, unknown> & { id: string };
  let places: PlaceRow[];
  if (isSuperAdmin) {
    if (!requestedPlaceId) {
      return json(
        { ok: false, error: "super-admin overview requires placeId" },
        400,
      );
    }
    // One round trip for both: the place row, and the materialized enrichment
    // map the Status box's `enriched` high-water reads from (MESITA-1249).
    // Parallel, so the extra fact costs no latency. `enrichment` is read off
    // `places` directly, not `profiles` — it is deliberately NOT in the
    // profiles view's column list (same reasoning as the embedding/status
    // columns just above staying admin-only: a heavy field only this file and
    // admin-web-search-places need, and adding it to the view means rebuilding
    // its two INSTEAD OF triggers, a documented recurring pain point).
    const [placeRow, enrichmentRow] = await Promise.all([
      admin
        .from("profiles")
        .select(
          PLACE_COLUMNS + PLACE_ADMIN_EMBEDDING_COLUMNS + PLACE_ADMIN_STATUS_COLUMNS,
        )
        .eq("id", requestedPlaceId)
        .maybeSingle(),
      admin
        .from("places")
        .select(
          "enrichment, mesita_pay_enabled, credits_enabled, pickup_orders_enabled, delivery_orders_enabled",
        )
        .eq("id", requestedPlaceId)
        .maybeSingle(),
    ]);
    if (placeRow.error) {
      return json({ ok: false, error: placeRow.error.message }, 500);
    }
    if (!placeRow.data) {
      return json({ ok: false, error: "Place not found" }, 404);
    }
    const placeFields = placeRow.data as unknown as Record<string, unknown>;
    // Same best-effort posture: a missing/null row simply falls back to the
    // CREATED-floor default, which reads as 0 — the Status box and the
    // catalog table MUST show the same number either way, a status that
    // disagrees with itself across two screens being worse than no status.
    if (enrichmentRow.error) {
      console.error("[get-overview] places.enrichment:", enrichmentRow.error.message);
    }
    const enrichmentMap = (enrichmentRow.data?.enrichment as EnrichmentMap | null) ??
      { functions: {}, highWater: 0, blockedAt: null };
    const enrichPulse = enrichmentMap.highWater;
    // WHY it stopped, beside where. Function 1 can now FAIL a place Google
    // reports permanently closed, so the number 0 carries two different facts
    // — "seeded, nothing tried" and "we asked, and the listing is dead". The
    // reason rides along with the same map the number came from, so the two
    // can never disagree.
    const enrichPulseBlocked = enrichmentMap.blockedAt;
    // Tag as owner so any downstream UI that gates on role still works —
    // super-admin gets the broadest permission set the place role enum
    // can express. (The frontend MyPlace type only knows owner|business|staff.)
    // `name` arrives already resolved — it is a generated column
    // (mesita_name → google_name), so no display pass is needed here.
    //
    // The three pipeline facts of Status ride along, admin-only and computed
    // (never stored): seeded · listed · enriched. The other three the box
    // derives itself — partner and promoting from columns already on this row,
    // verified from admin-web-get-place-verification. The four acceptance
    // INTENT BITS (mesita_pay · credits · pickup · delivery, the Partner tab's
    // rail toggles) ride the same places-direct side-read as enrichment —
    // never through profiles (the view is anon-readable) — and are forwarded
    // only when the read returned a boolean, so a failed read renders "?"
    // not a false "no".
    const acceptanceRow = (enrichmentRow.data ?? null) as
      | {
        mesita_pay_enabled?: unknown;
        credits_enabled?: unknown;
        pickup_orders_enabled?: unknown;
        delivery_orders_enabled?: unknown;
      }
      | null;
    places = [
      {
        ...placeFields,
        my_role: "owner",
        seeded: isPlaceSeeded(placeFields.google_place_id),
        listed: isPlaceListed(placeFields.status),
        requested: isPlaceRequested({
          requestCount: placeFields.request_count,
          contentStatus: placeFields.content_status,
        }),
        enrich_pulse: enrichPulse,
        enrich_pulse_total: PULSE_TOTAL,
        enrich_pulse_labels: PULSE_LABELS_IN_ORDER,
        enrich_pulse_blocked: enrichPulseBlocked,
        enrich_functions: operatorFunctionStates(
          enrichmentMap.functions as Partial<Record<string, FunctionState>>,
        ),
        ...(typeof acceptanceRow?.mesita_pay_enabled === "boolean"
          ? { mesita_pay_enabled: acceptanceRow.mesita_pay_enabled }
          : {}),
        ...(typeof acceptanceRow?.credits_enabled === "boolean"
          ? { credits_enabled: acceptanceRow.credits_enabled }
          : {}),
        ...(typeof acceptanceRow?.pickup_orders_enabled === "boolean"
          ? { pickup_orders_enabled: acceptanceRow.pickup_orders_enabled }
          : {}),
        ...(typeof acceptanceRow?.delivery_orders_enabled === "boolean"
          ? { delivery_orders_enabled: acceptanceRow.delivery_orders_enabled }
          : {}),
      } as unknown as PlaceRow,
    ];
  } else {
    // Pull every place the caller is a member of, with the role on each row.
    // Read via profiles so Promos v4 membership columns (MESITA-542) and
    // project rate/plan fields round-trip with the place profile.
    const memberRows = await admin
      .from("project_members")
      .select(`role, place_id`)
      .eq("manager_id", userId)
      .order("created_at", { ascending: false });
    if (memberRows.error) {
      return json({ ok: false, error: memberRows.error.message }, 500);
    }
    type MemberRow = { role: string; place_id: string };
    const members = (memberRows.data ?? []) as MemberRow[];
    const ids = members.map((m) => m.place_id);
    const roleById = new Map(members.map((m) => [m.place_id, m.role]));
    if (ids.length === 0) {
      places = [];
    } else {
      const placeRows = await admin
        .from("profiles")
        .select(PLACE_COLUMNS)
        .in("id", ids);
      if (placeRows.error) {
        return json({ ok: false, error: placeRows.error.message }, 500);
      }
      places = ((placeRows.data ?? []) as unknown as PlaceRow[]).map((p) => ({
        ...p,
        my_role: roleById.get(p.id) ?? "viewer",
      } as unknown as PlaceRow));
    }
  }

  // Pick the active place. Honour the requested id when it matches a
  // membership; otherwise fall back to the first place.
  const active = places.length === 0
    ? null
    : (requestedPlaceId && places.find((v) => (v as { id: string }).id === requestedPlaceId)) ||
        places[0];

  // Staff Check PIN (MESITA-823) — attached to the ACTIVE place only, and
  // only for owners (super-admin path tags my_role=owner). Read straight
  // off projects: the column is deliberately NOT in profiles / PLACE_COLUMNS
  // so no consumer- or viewer-facing payload can ever pick it up. The bill
  // is always required (MESITA-1095); there is no per-place switch.
  if (active && (active as { my_role?: string }).my_role === "owner") {
    const pinRow = await admin
      .from("projects")
      .select("check_pin")
      .eq("id", (active as { id: string }).id)
      .maybeSingle();
    if (!pinRow.error) {
      const row = pinRow.data as { check_pin: string | null } | null;
      (active as Record<string, unknown>).check_pin = row?.check_pin ?? null;
    }
  }

  // Recent tickets for the active place (skipped when ticketsLimit=0 or
  // there's no active place — saves a query the layout doesn't care about).
  let recentTickets: unknown[] = [];
  if (active && ticketsLimit > 0) {
    const activeId = (active as { id: string }).id;
    const tx = await admin
      .from("visit_tickets")
      .select(
        // story_ojo_* (MESITA-1034): same rationale as business-web-list-tickets.
        "id, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, story_ojo_verdict, story_ojo_confidence, story_ojo_reasons, bill_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_percent, discount_cents, revealed_at, currency, created_at, paid_at, cancelled_at, cancel_reason, consumer:consumers(id, code, full_name)",
      )
      .eq("place_id", activeId)
      .order("created_at", { ascending: false })
      .limit(ticketsLimit);
    if (tx.error) {
      // Don't fail the whole overview if tickets fail — surface as empty list
      // with an error breadcrumb the client can log.
      console.error("[business-web-get-overview] ticket fetch:", tx.error.message);
    } else {
      recentTickets = tx.data ?? [];
    }
  }

  // The v10 promos config, so the console's Promos page quotes the SAME
  // numbers the bill engine pays (MESITA-1001). Before this, the console
  // derived its rate table from the frozen `strategies.ts` presets, which
  // the engine stopped reading when it went additive-v10 (MESITA-992) —
  // on Aggressive that under-reported returning visits by 10 points.
  // Product terms, not sensitive: every guest sees these rates at the bill.
  let rewardsConfig: unknown = null;
  {
    const cfg = await admin
      .from("app_config")
      .select("promos_config")
      .maybeSingle();
    if (cfg.error) {
      // Non-fatal — the client falls back to its bundled defaults and says so.
      console.error("[business-web-get-overview] promos_config:", cfg.error.message);
    } else {
      const blob = (cfg.data as { promos_config?: Record<string, unknown> } | null)
        ?.promos_config;
      // v11 is the live shape; a leftover v10 blob is passed through and the
      // business client migrates it (coercePromosConfig) — same contract the
      // admin console uses.
      rewardsConfig = blob?.v11 ?? blob?.v10 ?? null;
    }
  }

  return json({
    ok: true,
    user: { id: userId, email: userEmail },
    // Drives the business web's Topbar "Super-admin mode" banner.
    isSuperAdmin,
    places,
    rewardsConfig,
    active: active
      ? {
          place: active,
          recentTickets,
        }
      : null,
  });
});

function clampTicketsLimit(raw: unknown): number {
  if (raw == null) return 20;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20;
  if (n <= 0) return 0;
  return Math.min(100, Math.trunc(n));
}
