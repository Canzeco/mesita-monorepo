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
//
// ── IT USED TO WAIT ON ITSELF (MESITA-1876) ───────────────────────────────
//
// Pato: *"do the sequential db hops too."* Measured before: p50 472ms, p95
// 913ms over 24h — the read behind the whole Place screen's hard load.
//
// The chain ran ONE QUERY AT A TIME, and most of them did not need the one
// before: `checkSuperAdmin` → `place_members` → the org membership read →
// `places` → `profiles` → the pin row → `app_config`. Seven round trips in a
// row for an ordinary operator, on a project where a call costs far more than
// the query inside it.
//
// THREE THINGS NOW OVERLAP, and each is a different kind of claim:
//
//   `app_config`      depends on NOTHING here and used to run LAST, blocking
//                     the response for pure latency. It starts first and is
//                     awaited at the end. Free.
//   the pin row       reads `places.check_pin` for whichever place ends up
//                     ACTIVE. The console always sends a placeId, and on the
//                     super-admin branch the requested id IS the active one by
//                     construction — so it is fired on the REQUESTED id
//                     alongside the place read, and costs a second round trip
//                     only in the fallback case (a requested id the caller
//                     does not hold, so `active` becomes places[0]).
//   the membership    is keyed on `userId` alone and reads nothing from
//   read              `checkSuperAdmin`, so both start together. THIS ONE IS A
//                     SPECULATION AND IT HAS A PRICE: a super-admin takes the
//                     result nowhere and pays an indexed `manager_id` lookup
//                     for nothing. One cheap wasted read for the handful of
//                     staff accounts, one fewer serial hop for every customer.
//                     Deliberate — do not "fix" it back.
//
// Nothing about the payload, the auth posture or the branch logic changed, and
// every best-effort read still degrades to its documented fallback rather than
// failing the overview.
//
// ── THE SECOND MEMBERSHIP READ IS GONE (MESITA-1892) ──────────────────────
//
// There used to be two: `place_members`, and `organization_members` joined
// onto `places.organization_id` — because a place held by an organization had
// no direct row, so every org member but the claimer saw an empty console.
// That derived role was CAPPED AT EDITOR, since `owner` has to be a
// place_members row (auth-membership.ts states why). The removal migration
// turned every org grant into a real place_members row at that same editor
// ceiling, so nobody lost access when the join disappeared, and one read is
// now the whole answer.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  checkSuperAdmin,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS as PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { isPlaceListed, isPlaceRequested, isPlaceSeeded } from "../_shared/place-state.ts";
import { CRENUP_LABELS_IN_ORDER, CRENUP_TOTAL } from "../_shared/crenup-ladder.ts";
import type { EnrichmentMap, FunctionState } from "../_shared/schema-catalog.ts";
import { operatorFunctionStates } from "../_shared/schema-catalog.ts";

// Super-admin manage-single extra: the Embeddings card (MESITA-720). Keep it
// off the business overview payload; only elevate when the caller is a
// super-admin.
const PLACE_ADMIN_EMBEDDING_COLUMNS =
  ", embedding, embedding_source_hash, embedding_source_text, name_embedding, name_embedding_hash";

// State (MESITA-1186). The place editor's State box answers `seeded` off the
// identity spine, so the super-admin read needs the column. Admin-only for the
// same reason the embedding columns are: a business has no use for Google's id,
// and it must never widen PLACE_PUBLIC_COLUMNS.
const PLACE_ADMIN_STATE_COLUMNS = ", google_place_id";

/** Start a read now, and make it safe to NEVER await (MESITA-1876).
 *
 *  Three of the reads below are speculative: a super-admin takes neither
 *  membership result, and the pin row is discarded when `active` falls back to
 *  a place other than the one requested. A floating promise that rejects is an
 *  UNHANDLED REJECTION, which in a Deno isolate is a 500 with no body and no
 *  log line anyone would connect to this file — for a super-admin, on a
 *  transient blip, in a branch nobody reads.
 *
 *  Attaching a no-op catch to the adopted promise marks the original handled.
 *  The returned promise still REJECTS when awaited, so a caller that does read
 *  it sees exactly what it saw before this change. (In practice supabase-js
 *  resolves query failures as `{ error }` rather than rejecting; this is
 *  against the case where it does not.) */
function fireAndForgettable<T>(p: PromiseLike<T>): Promise<T> {
  const q = Promise.resolve(p);
  q.catch(() => {});
  return q;
}

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

  // Auth: any signed-in user. Super-admin elevation (skips place_members
  // and returns the requested place) is granted when the caller's email
  // is in public.super_admins.
  const admin = adminClient(envRes.env);

  const body = await readJsonOr<Body>(req, {});
  const requestedPlaceId = readPlaceIdAlias(body) || null;
  // 0 means "don't fetch tickets at all" — the sidebar layout doesn't need
  // them, only the active page does.
  const ticketsLimit = clampTicketsLimit(body.ticketsLimit);

  // EVERYTHING THAT NEEDS ONLY THE USER ID STARTS NOW (MESITA-1876). Promises,
  // not awaits: each is awaited at the first line that actually reads it, so
  // the branch structure below is unchanged and only the waiting is gone.
  //
  // The membership read is SPECULATIVE — see the head comment. It is a pure
  // read on an indexed `manager_id`, so firing one a super-admin will discard
  // is a cost, never a risk.
  const superAdminP = checkSuperAdmin(admin, authRes.user);
  const memberRowsP = fireAndForgettable(
    admin
      .from("place_members")
      .select(`role, place_id`)
      .eq("manager_id", userId)
      .order("created_at", { ascending: false }),
  );
  // The rates the bill engine pays. Nothing in this function reads them, so
  // the only thing its position ever decided was how long the response waited.
  // Guarded like the speculative three, and for a reason that is easy to
  // miss: this one IS always awaited on the happy path, but every early
  // return above it — the super-admin 400, the 404, the two 500s — leaves it
  // floating. An error response is exactly when a second unhandled rejection
  // is least welcome.
  const rewardsConfigP = fireAndForgettable(
    admin
      .from("app_config")
      .select("promos_config")
      .maybeSingle(),
  );
  // The staff PIN of the place that will BE active. Speculated on the
  // requested id; re-read below only when `active` turns out to be a
  // different place.
  const pinRowP = requestedPlaceId
    ? fireAndForgettable(
      admin
        .from("places")
        .select("check_pin")
        .eq("id", requestedPlaceId)
        .maybeSingle(),
    )
    : null;

  const isSuperAdmin = await superAdminP;

  // Super-admin path: skip place_members. Require an explicit placeId
  // (legacy body keys projectId/activeUnitId still accepted via
  // readPlaceIdAlias; the link generator always supplies one) and return
  // a single-row list.
  type PlaceProfileRow = Record<string, unknown> & { id: string };
  let places: PlaceProfileRow[];
  if (isSuperAdmin) {
    if (!requestedPlaceId) {
      return json(
        { ok: false, error: "super-admin overview requires placeId" },
        400,
      );
    }
    // One round trip for both: the place row, and the materialized enrichment
    // map the State box's `enriched` high-water reads from (MESITA-1249).
    // Parallel, so the extra fact costs no latency. `enrichment` is read off
    // `place_profiles` directly, not `profiles` — it is deliberately NOT in the
    // profiles view's column list (same reasoning as the embedding/state
    // columns just above staying admin-only: a heavy field only this file and
    // admin-web-search-places need, and adding it to the view means rebuilding
    // its two INSTEAD OF triggers, a documented recurring pain point).
    const [placeRow, enrichmentRow] = await Promise.all([
      admin
        .from("profiles")
        .select(
          PLACE_PROFILE_COLUMNS + PLACE_ADMIN_EMBEDDING_COLUMNS + PLACE_ADMIN_STATE_COLUMNS,
        )
        .eq("id", requestedPlaceId)
        .maybeSingle(),
      admin
        .from("place_profiles")
        .select(
          "enrichment, mesita_pay_enabled, credits_enabled, pickup_orders_enabled, delivery_orders_enabled, reservations_enabled",
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
    // CREATED-floor default, which reads as 0 — the State box and the
    // catalog table MUST show the same number either way, a state that
    // disagrees with itself across two screens being worse than no state.
    if (enrichmentRow.error) {
      console.error("[get-overview] places.enrichment:", enrichmentRow.error.message);
    }
    const enrichmentMap = (enrichmentRow.data?.enrichment as EnrichmentMap | null) ??
      { functions: {}, highWater: 0, blockedAt: null };
    const enrichCrenup = enrichmentMap.highWater;
    // WHY it stopped, beside where. Function 1 can now FAIL a place Google
    // reports permanently closed, so the number 0 carries two different facts
    // — "seeded, nothing tried" and "we asked, and the listing is dead". The
    // reason rides along with the same map the number came from, so the two
    // can never disagree.
    const enrichCrenupBlocked = enrichmentMap.blockedAt;
    // Tag as owner so any downstream UI that gates on role still works —
    // super-admin gets the broadest permission set the place role enum
    // can express. (The frontend MyPlace type only knows owner|business|staff.)
    // `name` arrives already resolved — it is a generated column
    // (mesita_name → google_name), so no display pass is needed here.
    //
    // The three pipeline facts of State ride along, admin-only and computed
    // (never stored): seeded · listed · enriched. The other three the box
    // derives itself — partner and promoting from columns already on this row,
    // verified from admin-web-get-place-verification. The four acceptance
    // INTENT BITS (mesita_pay · credits · pickup · delivery, the Partner tab's
    // rail toggles) ride the same place_profiles-direct side-read as enrichment —
    // never through profiles (the view is anon-readable) — and are forwarded
    // only when the read returned a boolean, so a failed read renders "?"
    // not a false "no".
    const acceptanceRow = (enrichmentRow.data ?? null) as
      | {
        mesita_pay_enabled?: unknown;
        credits_enabled?: unknown;
        pickup_orders_enabled?: unknown;
        delivery_orders_enabled?: unknown;
        // Read because the CONSUMER app already books off this column
        // (`isReserveActionEnabled`). The console used to hard-code the row
        // off, so it claimed a place takes no bookings while guests were
        // making them (MESITA-1735). Written today only by the Enricher.
        reservations_enabled?: unknown;
      }
      | null;
    places = [
      {
        ...placeFields,
        my_role: "owner",
        seeded: isPlaceSeeded(placeFields.google_place_id),
        listed: isPlaceListed(placeFields.state),
        requested: isPlaceRequested({
          requestCount: placeFields.request_count,
          contentState: placeFields.content_state,
        }),
        enrich_crenup: enrichCrenup,
        enrich_crenup_total: CRENUP_TOTAL,
        enrich_crenup_labels: CRENUP_LABELS_IN_ORDER,
        enrich_crenup_blocked: enrichCrenupBlocked,
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
        ...(typeof acceptanceRow?.reservations_enabled === "boolean"
          ? { reservations_enabled: acceptanceRow.reservations_enabled }
          : {}),
      } as unknown as PlaceProfileRow,
    ];
  } else {
    // Pull every place the caller is a member of, with the role on each row.
    // Read via profiles so Promos v4 membership columns (MESITA-542) and
    // place rate/plan fields round-trip with the place profile.
    const memberRows = await memberRowsP;
    if (memberRows.error) {
      return json({ ok: false, error: memberRows.error.message }, 500);
    }
    type MemberRow = { role: string; place_id: string };
    const members = (memberRows.data ?? []) as MemberRow[];

    // The membership rows ARE the portfolio (MESITA-1892). The org-derived
    // second path this used to merge in — places held by an organization the
    // caller belonged to, at a role capped to editor — has no source table
    // left, and needs none: the migration wrote each of those grants as a real
    // place_members row at the same ceiling, so they arrive above.
    const roleById = new Map(members.map((m) => [m.place_id, m.role]));

    const ids = [...roleById.keys()];
    if (ids.length === 0) {
      places = [];
    } else {
      const placeRows = await admin
        .from("profiles")
        .select(PLACE_PROFILE_COLUMNS)
        .in("id", ids);
      if (placeRows.error) {
        return json({ ok: false, error: placeRows.error.message }, 500);
      }
      places = ((placeRows.data ?? []) as unknown as PlaceProfileRow[]).map((p) => ({
        ...p,
        my_role: roleById.get(p.id) ?? "viewer",
      } as unknown as PlaceProfileRow));
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
  // off places: the column is deliberately NOT in profiles / PLACE_PROFILE_COLUMNS
  // so no consumer- or viewer-facing payload can ever pick it up. The bill
  // is always required (MESITA-1095); there is no per-place switch.
  if (active) {
    const activeId = (active as { id: string }).id;
    // The speculative read above already asked for the REQUESTED place, which
    // is the active one on every call the console makes (and, on the
    // super-admin branch, by construction). A second round trip is spent only
    // when `active` fell back to places[0] — a requested id the caller does
    // not hold, or no id at all.
    const pinRow = pinRowP && activeId === requestedPlaceId
      ? await pinRowP
      : await admin
        .from("places")
        .select("check_pin")
        .eq("id", activeId)
        .maybeSingle();
    if (!pinRow.error) {
      const row = pinRow.data as { check_pin: string | null } | null;
      // The VALUE stays owner-only; the BOOLEAN is member-visible so the
      // activation checklist can say "Set the staff PIN" honestly
      // (MESITA-1537 E-H4). Never widen beyond the boolean.
      (active as Record<string, unknown>).has_pin = Boolean(row?.check_pin);
      if ((active as { my_role?: string }).my_role === "owner") {
        (active as Record<string, unknown>).check_pin = row?.check_pin ?? null;
      }
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
        "id, state, story_state, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, story_ojo_verdict, story_ojo_confidence, story_ojo_reasons, bill_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_percent, discount_cents, revealed_at, currency, created_at, paid_at, cancelled_at, cancel_reason, consumer:consumers(id, code, full_name)",
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
  //
  // The read was kicked off before any of the above (MESITA-1876); this is
  // where its answer is finally needed, and by now it has almost always
  // landed.
  let rewardsConfig: unknown = null;
  {
    const cfg = await rewardsConfigP;
    if (cfg.error) {
      // Non-fatal — the client falls back to its bundled defaults and says so.
      console.error("[business-web-get-overview] promos_config:", cfg.error.message);
    } else {
      const blob = (cfg.data as { promos_config?: Record<string, unknown> } | null)
        ?.promos_config;
      // v12 is the live shape; a leftover v10 or v11 blob is passed through
      // and the business client migrates it (coercePromosConfig) — same
      // contract the admin console uses. Newest key first: a blob restored
      // mid-cutover can carry more than one, and reading the older one would
      // quote rates the bill engine no longer pays.
      rewardsConfig = blob?.v12 ?? blob?.v11 ?? blob?.v10 ?? null;
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
