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

// Super-admin manage-single extras: the Embeddings card (MESITA-720) and the
// per-place manual_priority override. Keep both off the business overview
// payload; only elevate when the caller is a super-admin.
//
// manual_priority no longer feeds anything (MESITA-1048 deleted the Lineup
// engine that read it) — the column and this editor stay so operator intent
// survives the rebuild.
const PLACE_ADMIN_EMBEDDING_COLUMNS =
  ", embedding, embedding_source_hash, embedding_source_text, manual_priority";

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
    const placeRow = await admin
      .from("projects_view")
      .select(PLACE_COLUMNS + PLACE_ADMIN_EMBEDDING_COLUMNS)
      .eq("id", requestedPlaceId)
      .maybeSingle();
    if (placeRow.error) {
      return json({ ok: false, error: placeRow.error.message }, 500);
    }
    if (!placeRow.data) {
      return json({ ok: false, error: "Place not found" }, 404);
    }
    // Tag as owner so any downstream UI that gates on role still works —
    // super-admin gets the broadest permission set the place role enum
    // can express. (The frontend MyPlace type only knows owner|business|staff.)
    // `name` arrives already resolved — it is a generated column
    // (mesita_name → google_name), so no display pass is needed here.
    places = [
      {
        ...(placeRow.data as unknown as Record<string, unknown>),
        my_role: "owner",
      } as unknown as PlaceRow,
    ];
  } else {
    // Pull every place the caller is a member of, with the role on each row.
    // Read via projects_view so Promos v4 membership columns (MESITA-542) and
    // project rate/plan fields round-trip with the place profile.
    const memberRows = await admin
      .from("project_members")
      .select(`role, project_id`)
      .eq("business_id", userId)
      .order("created_at", { ascending: false });
    if (memberRows.error) {
      return json({ ok: false, error: memberRows.error.message }, 500);
    }
    type MemberRow = { role: string; project_id: string };
    const members = (memberRows.data ?? []) as MemberRow[];
    const ids = members.map((m) => m.project_id);
    const roleById = new Map(members.map((m) => [m.project_id, m.role]));
    if (ids.length === 0) {
      places = [];
    } else {
      const placeRows = await admin
        .from("projects_view")
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

  // Staff check settings — the PIN (MESITA-823) and the require-bill switch
  // (MESITA-898) — attached to the ACTIVE place only, and only for owners
  // (super-admin path tags my_role=owner). Read straight off projects: the
  // columns are deliberately NOT in projects_view / PLACE_COLUMNS so no
  // consumer- or viewer-facing payload can ever pick them up.
  if (active && (active as { my_role?: string }).my_role === "owner") {
    const pinRow = await admin
      .from("projects")
      .select("check_pin, check_require_bill")
      .eq("id", (active as { id: string }).id)
      .maybeSingle();
    if (!pinRow.error) {
      const row = pinRow.data as
        | { check_pin: string | null; check_require_bill: boolean | null }
        | null;
      (active as Record<string, unknown>).check_pin = row?.check_pin ?? null;
      (active as Record<string, unknown>).check_require_bill =
        row?.check_require_bill === true;
    }
  }

  // Recent tickets for the active place (skipped when ticketsLimit=0 or
  // there's no active place — saves a query the layout doesn't care about).
  let recentTickets: unknown[] = [];
  if (active && ticketsLimit > 0) {
    const activeId = (active as { id: string }).id;
    const tx = await admin
      .from("tickets")
      .select(
        "id, kind, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, check_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_percent, discount_cents, revealed_at, reservation_status, reservation_at, reservation_party_size, currency, created_at, paid_at, cancelled_at, cancel_reason, consumer:consumers(id, code, full_name)",
      )
      .eq("project_id", activeId)
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
      .from("app_settings")
      .select("rewards_config")
      .maybeSingle();
    if (cfg.error) {
      // Non-fatal — the client falls back to its bundled defaults and says so.
      console.error("[business-web-get-overview] rewards_config:", cfg.error.message);
    } else {
      const blob = (cfg.data as { rewards_config?: Record<string, unknown> } | null)
        ?.rewards_config;
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
