// Supabase Edge Function — business-web-list-places
//
// Three scopes, one endpoint:
//   scope: "all"    — THE CONSOLE'S LIST (MESITA-1614): everything an
//                     organization can act on — what it holds AND what it
//                     could claim, in one page. Requires organizationId and
//                     org membership, exactly like "org".
//   scope: "org"    — the places an organization holds (caller must be in it)
//   scope: "public" — the PUBLIC POOL, claimable by any organization
//
// "all" EXISTS BECAUSE OWNED IS A STATE. The console used to be two screens,
// and each pre-filtered the fact its own matrix was trying to show: Owned is
// always true where the query is `.eq(organization_id, org)` and always false
// where it is `.is(organization_id, null)`. A column that cannot vary is not a
// column. One list makes Owned — and Partner, and Verified — answer per row.
//
// It is also the scope that can afford to tell the truth. `getAuthedUser`
// accepts ANY bearer token and the backend is a singleton, so scope=public is
// reachable by every consumer account and withholds Partner / Verified / the
// intake map for that reason. "all" runs behind `requireOrgRole`, so the
// caller is a verified business member and every fact ships for every row.
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
//   2. NOTHING FROM INTAKE SHIPS, and MESITA-1637 is why. This payload used to
//      carry the high-water meter, and MESITA-1608 added the per-function map
//      beside it so the console could render one column per intake function.
//      Pato, 2026-09-07: "the intake states are internal." Those columns are
//      gone from the business matrix, and hiding a fact in the client while
//      still handing it to every business browser is not the same thing as it
//      being internal — so both left the wire.
//
//      Enriching and Enriched SURVIVE as general columns, and neither needs
//      intake: `enriching` is `isPlaceEnriching` and `enriched` is
//      `isPlaceEnriched(enriched_at)`, both straight off the row. Enriching
//      and Enriched are facts about the PLACE; the eleven functions and the
//      meter are facts about our machinery. The map still ships from
//      business-web-get-overview, which feeds the super-admin-only Admin tab.
//
//   3. Every state fact is DERIVED BY THE SHARED HELPERS, never re-implemented
//      here. Listed / Requested / Enriching / Enriched disagreeing between
//      this list and the Place screen is worse than not showing them. Created
//      is `isPlaceSeeded` and Partner is `isPaidPlan` — the same readers the
//      Place screen and the admin catalog use.
//
//   4. THE POOL IS NOT A BUSINESS-ONLY AUDIENCE. `getAuthedUser` accepts any
//      valid bearer token, and the backend is a singleton (one Supabase
//      project behind consumer, business, admin and landing), so EVERY
//      consumer account can call this endpoint with scope=public. Facts about
//      a place nobody holds — whether someone proved ownership, what plan it
//      is on — are therefore withheld on THAT scope and ship as `undefined`,
//      which the console renders as "?" rather than as a false "no". The
//      complete fix is a ROLE check (`app_metadata.role`), not the
//      manager-row check MESITA-1612 assumed: that row is minted lazily for
//      any signed-in account and gates nobody (MESITA-1623). Until it lands,
//      withholding is the safe direction.
//
//      The withholding keys off the CALLER's clearance, not off whether the
//      place is held — which is why "all" ships everything even for pool rows.
//      Getting that backwards would blank half the matrix on the one screen
//      built to compare the two.

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
  isPlaceSeeded,
} from "../_shared/place-state.ts";
import { isPaidPlan } from "../_shared/membership-enforcement-helpers.ts";

type Body = {
  scope?: "all" | "org" | "public";
  organizationId?: string;
  query?: string;
  limit?: number;
};

const MAX_LIMIT = 100;

/** Verification ids per `.in()`. Same size admin uses; `chunked([])` yields no
 *  chunks, so an empty catalog issues ZERO queries rather than an empty
 *  filter — which matters because with no places that is every request. */
const ID_CHUNK = 200;

function chunked<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** The place half of the row. Kept to columns that already exist on
 *  `places` — this endpoint adds no schema and computes no new fact. */
const PLACE_PROFILE_EMBED =
  "name, address, zone, photos, enriched_at, request_count, business_state, " +
  "google_place_id, orders_enabled, pickup_orders_enabled, " +
  "delivery_orders_enabled, reservations_enabled, mesita_pay_enabled, " +
  "credits_enabled";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const scope = body.scope === "org" || body.scope === "all"
    ? body.scope
    : "public";
  // Everything but the open pool is a MEMBERSHIP read, and both membership
  // scopes ship the full fact set.
  const memberScope = scope === "org" || scope === "all";
  const limit = Math.min(Math.max(body.limit ?? 50, 1), MAX_LIMIT);
  const search = (body.query ?? "").trim();

  const admin = adminClient(envRes.env);

  let q = admin
    .from("projects")
    // `plan` is a projects column, not a profile one — Partner is
    // `isPaidPlan(plan)` and needs no extra read.
    .select(
      `id, state, content_state, organization_id, claimed_at, plan, ` +
        `place_profiles!inner(${PLACE_PROFILE_EMBED}), organizations(name)`,
    )
    .limit(limit);

  if (memberScope) {
    const organizationId = body.organizationId;
    if (!organizationId) {
      return json(
        { ok: false, error: `organizationId is required for scope=${scope}` },
        400,
      );
    }
    // Reading an organization's portfolio is a membership fact: any role.
    const roleRes = await requireOrgRole(admin, authRes.user, organizationId, [
      "owner",
      "editor",
      "viewer",
    ]);
    if (!roleRes.ok) return roleRes.response;
    if (scope === "org") {
      q = q.eq("organization_id", organizationId);
    } else {
      // "all" — held by THIS organization, or held by nobody. PostgREST `or`
      // takes one string; `is.null` is the null test, not `eq.null`.
      q = q.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }
  } else {
    q = q.is("organization_id", null);
  }

  // Escape LIKE wildcards, the way admin-web-search-places does. Raw text
  // leaves `_` and `%` live, so a guest typing "cafe_" silently matches
  // "cafes" — the two search boxes must behave the same way.
  if (search) {
    const escaped = search.replace(/[%_\\]/g, (m) => `\\${m}`);
    q = q.ilike("place_profiles.name", `%${escaped}%`);
  }

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    id: string;
    state: string | null;
    content_state: string | null;
    organization_id: string | null;
    claimed_at: string | null;
    plan: string | null;
    place_profiles: {
      name: string;
      address: string | null;
      zone: string | null;
      photos: string[] | null;
      enriched_at: string | null;
      request_count: number | null;
      business_state: string | null;
      google_place_id: string | null;
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
  // The pool predicate, wherever unheld rows appear. A place with a direct
  // project_members owner is NOT claimable even with organization_id null —
  // it has a real operator who claimed it the old way. On "all" the filter
  // must spare this organization's OWN rows, which are held by definition.
  if (scope === "public" || scope === "all") {
    const owned = await placeIdsWithDirectOwner(admin);
    rows = rows.filter((r) => r.organization_id !== null || !owned.has(r.id));
  }

  // VERIFIED is ownership PROOF — an approved project_verifications row, the
  // same fact admin-web-search-places reads. Batched with `.in()`, never per
  // row: at MAX_LIMIT a per-row lookup would be 100 queries inside one
  // request. Withheld entirely on the pool (header rule 4).
  //
  // Best-effort, and it degrades to UNKNOWN rather than to false. An empty Set
  // would state "nobody here is verified", which is a claim we did not read;
  // `null` says "we could not find out", and the console renders "?". The
  // logged line is what tells those two apart three weeks from now.
  let verified: Set<string> | null = null;
  if (memberScope) {
    verified = new Set<string>();
    const ids = rows.map((r) => r.id).filter(Boolean);
    for (const idPart of chunked(ids, ID_CHUNK)) {
      const { data: vs, error: vErr } = await admin
        .from("project_verifications")
        .select("place_id")
        .eq("state", "approved")
        .in("place_id", idPart);
      if (vErr) {
        console.error("[list-places] project_verifications:", vErr.message);
        verified = null;
        break;
      }
      for (const v of (vs ?? []) as { place_id: string }[]) {
        verified.add(String(v.place_id));
      }
    }
  }

  return json({
    ok: true,
    scope,
    places: rows.map((r) => {
      const p = r.place_profiles;
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
        // Created — the identity spine, off the same helper the Place screen
        // and the admin catalog use.
        seeded: isPlaceSeeded(p.google_place_id),
        // Owned — this place sits in an organization. Constant per scope
        // today (org lists filter on it, the pool filters on its absence);
        // shipped anyway so both screens render one column set, and so it
        // becomes meaningful the moment an unfiltered list exists.
        owned: r.organization_id !== null,
        // Partner — plan !== free. Withheld on the pool: what an unheld place
        // pays is not a guest's business.
        partner: memberScope ? isPaidPlan(r.plan) : undefined,
        // Verified — approved ownership proof. `undefined` when withheld OR
        // when the lookup failed, so the console says "?" instead of "no".
        verified: verified ? verified.has(r.id) : undefined,
        // NO INTAKE. The per-function map and the high-water meter both used
        // to ship here for the console's Intake columns. Those columns are
        // gone (MESITA-1637) — how far our pipeline got is internal, and
        // hiding it in the client while still handing it to every business
        // browser is not the same thing. Enriching and Enriched survive as
        // GENERAL columns and neither reads intake: `enriching` is its own
        // boolean above and `enriched` is `isPlaceEnriched(enriched_at)`.
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
