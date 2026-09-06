// Supabase Edge Function — business-web-list-places
//
// Two scopes, one endpoint:
//   scope: "org"    — the places an organization holds (caller must be in it)
//   scope: "public" — the PUBLIC POOL, claimable by any organization
//
// This is the business-side replacement for reading the catalogue through
// admin-web-search-places, which is super-admin-only: an ordinary business
// account can now see the pool and its own places.
//
// The pool predicate lives in _shared/place-claim.ts and is shared with
// business-web-claim-place ON PURPOSE. If listing and claiming ever
// disagree, a stranger claims a place the listing correctly hid.
//
// THE ROW CARRIES THE PLACE, not just its name (MESITA-1562). A row is
// photo · name · org · states, so the payload ships one thumbnail URL, the
// holder's NAME, and the state facts — all off columns that are already on
// the two tables being read. Three rules keep that from getting expensive:
//
//   1. `photoUrl` is `photos[0]`, ONE string, never the array. PostgREST
//      cannot slice a text[] in select=, so the array arrives whole and is
//      narrowed HERE — a 7-URL average across 100 rows never reaches the
//      browser (MESITA-1553).
//   2. The intake pulse is `places.enrichment->highWater`, a jsonb COLUMN.
//      It is not a join over enrich events; admin reads the same column.
//      Only the number is forwarded, never the functions map.
//   3. Every state fact is DERIVED BY THE SHARED HELPERS, never re-implemented
//      here. Listed / Requested / Enriching / Enriched disagreeing between
//      this list and the Place screen is worse than not showing them.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { placeIdsWithDirectOwner } from "../_shared/place-claim.ts";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceRequested,
} from "../_shared/place-state.ts";
import { PULSE_TOTAL, pulseOf } from "../_shared/pulse-pieces.ts";

type Body = {
  scope?: "org" | "public";
  organizationId?: string;
  query?: string;
  limit?: number;
};

const MAX_LIMIT = 100;

/** The place half of the row. Kept to columns that already exist on
 *  `places` — this endpoint adds no schema and computes no new fact. */
const PLACE_EMBED =
  "name, address, zone, photos, enriched_at, request_count, business_state, " +
  "enrichment, orders_enabled, pickup_orders_enabled, delivery_orders_enabled, " +
  "reservations_enabled, mesita_pay_enabled, credits_enabled";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const scope = body.scope === "org" ? "org" : "public";
  const limit = Math.min(Math.max(body.limit ?? 50, 1), MAX_LIMIT);
  const search = (body.query ?? "").trim();

  const admin = adminClient(envRes.env);

  let q = admin
    .from("projects")
    .select(
      `id, state, content_state, organization_id, claimed_at, ` +
        `places!inner(${PLACE_EMBED}), organizations(name)`,
    )
    .limit(limit);

  if (scope === "org") {
    const organizationId = body.organizationId;
    if (!organizationId) {
      return json({ ok: false, error: "organizationId is required for scope=org" }, 400);
    }
    // Reading an organization's portfolio is a membership fact: any role.
    const roleRes = await requireOrgRole(admin, authRes.user, organizationId, [
      "owner",
      "editor",
      "viewer",
    ]);
    if (!roleRes.ok) return roleRes.response;
    q = q.eq("organization_id", organizationId);
  } else {
    q = q.is("organization_id", null);
  }

  if (search) q = q.ilike("places.name", `%${search}%`);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    id: string;
    state: string | null;
    content_state: string | null;
    organization_id: string | null;
    claimed_at: string | null;
    places: {
      name: string;
      address: string | null;
      zone: string | null;
      photos: string[] | null;
      enriched_at: string | null;
      request_count: number | null;
      business_state: string | null;
      enrichment: unknown;
      orders_enabled: boolean | null;
      pickup_orders_enabled: boolean | null;
      delivery_orders_enabled: boolean | null;
      reservations_enabled: boolean | null;
      mesita_pay_enabled: boolean | null;
      credits_enabled: boolean | null;
    };
    organizations: { name: string } | null;
  };
  let rows = (data ?? []) as unknown as Row[];

  // A place with a direct project_members owner is NOT in the pool, even
  // with organization_id null — it has a real operator who claimed it the
  // old way. Zero such rows today; the guard is what keeps that true.
  if (scope === "public") {
    const owned = await placeIdsWithDirectOwner(admin);
    rows = rows.filter((r) => !owned.has(r.id));
  }

  return json({
    ok: true,
    scope,
    places: rows.map((r) => {
      const p = r.places;
      return {
        id: r.id,
        name: p.name,
        address: p.address,
        zone: p.zone,
        organizationId: r.organization_id,
        // The holder's NAME, so a row can say who holds it without a second
        // request. Null in the pool — a pooled place is held by nobody, and
        // the console renders that as "None" rather than inventing a holder.
        organizationName: r.organizations?.name ?? null,
        claimedAt: r.claimed_at,
        // ONE url. See rule 1 in the header.
        photoUrl: Array.isArray(p.photos) && p.photos.length > 0 ? p.photos[0] : null,
        // The state facts, off the shared helpers (rule 3).
        listed: isPlaceListed(r.state),
        requestCount: Number(p.request_count) || 0,
        requested: isPlaceRequested({
          requestCount: p.request_count,
          contentState: r.content_state,
          enrichedAt: p.enriched_at,
        }),
        enriching: isPlaceEnriching(r.content_state),
        enriched: isPlaceEnriched(p.enriched_at),
        // Google's OPERATIONAL fact — a FLAG, never a visibility gate.
        // NULL is silence, not "not operational".
        businessState: p.business_state,
        // Intake, as a meter: 0 is the CREATED floor, PULSE_TOTAL is done.
        intakePulse: pulseOf(p.enrichment),
        intakeTotal: PULSE_TOTAL,
        // The commercial rails, exactly the columns that exist.
        orders: p.orders_enabled === true,
        pickupOrders: p.pickup_orders_enabled === true,
        deliveryOrders: p.delivery_orders_enabled === true,
        reservations: p.reservations_enabled === true,
        mesitaPay: p.mesita_pay_enabled === true,
        credits: p.credits_enabled === true,
      };
    }),
  });
});
