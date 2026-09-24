// Supabase Edge Function — business-web-list-places
//
// Three scopes, one endpoint:
//   scope: "all"    — THE CONSOLE'S LIST (MESITA-1614): everything the caller
//                     can act on — what they hold AND what they could claim,
//                     in one page.
//   scope: "mine"   — the places the caller holds (their place_members rows)
//   scope: "public" — the PUBLIC POOL, claimable by any business account
//
// THE SCOPE USED TO NAME AN ORGANIZATION (MESITA-1892). `scope:"org"` took an
// `organizationId`, proved membership in it, and filtered on
// `places.organization_id`. The organization layer is gone: the caller's own
// `place_members` rows ARE the portfolio, so the scope needs no id at all and
// is named for whose places it returns. `scope:"mine"` is the same query the
// console always meant.
//
// "all" EXISTS BECAUSE OWNED IS A STATE. The console used to be two screens,
// and each pre-filtered the fact its own matrix was trying to show: Owned is
// always true in a portfolio query and always false in a pool query. A column
// that cannot vary is not a column. One list makes Owned — and Partner, and
// Verified — answer per row.
//
// It is also the scope that can afford to tell the truth. `getAuthedUser`
// accepts ANY bearer token and the backend is a singleton, so scope=public is
// reachable by every consumer account and withholds Partner / Verified / the
// Crenup map for that reason.
//
// WHAT PROVES A BUSINESS CALLER NOW. The org check used to do it: you named an
// organization and we proved you were in it. With no organization to name, the
// closest place-scoped equivalent is "you hold at least one place" — a
// `place_members` row, or super-admin. That is NARROWER than the gate it
// replaces, never wider: an account with no membership anywhere used to be
// able to create an organization and pass, and now simply reads the pool with
// the same facts withheld that scope=public withholds. An operator who holds
// nothing has nothing to compare the pool against anyway.
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
// photo · name · states, so the payload ships one thumbnail URL and the state
// facts — all off columns that are already on the two tables being read.
// Three rules keep that from getting expensive:
//
//   1. `photoUrl` is `photos[0]`, ONE string, never the array. PostgREST
//      cannot slice a text[] in select=, so the array arrives whole and is
//      narrowed HERE — a 7-URL average across 100 rows never reaches the
//      browser (MESITA-1553).
//   2. THE PER-FUNCTION MAP IS BACK ON THE WIRE (MESITA-1687), reversing
//      MESITA-1637. That change pulled `enrichFunctions` off this payload on
//      the theory that hiding a fact in the client while still handing it to
//      every business browser is not the same thing as the fact being
//      internal. Pato, 2026-09-08: ship it to every business browser again;
//      the console's own collapse toggle (default hidden) is what keeps it
//      out of sight now, not a server-side withhold. "Every business
//      browser" is not "every consumer account", though — `enrichFunctions`
//      is gated by `memberScope`, same as partner/verified below (rule 4),
//      so the pool does not hand our pipeline internals to a stranger who
//      merely holds a valid bearer token. It rides the SAME
//      `place_profiles.enrichment` column admin-web-search-places already
//      reads, folded through the same `operatorFunctionStates` — guarded,
//      because a null/missing map must not throw.
//
//      Enriching and Enriched stay general columns regardless: `enriching` is
//      `isPlaceEnriching` and `enriched` is `isPlaceEnriched(enriched_at)`,
//      both straight off the row, never off the map. Enriching and Enriched
//      are facts about the PLACE; the eleven functions are facts about our
//      machinery — the map answers a different question, not a replacement.
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
//
// THERE IS NO HOLDER NAME ON THE ROW ANY MORE. It used to be the holding
// organization's `name`, so a row could say who held it without a second
// request. A place is held by the ACCOUNT that claimed it now, and the only
// held rows this endpoint ever returns are the caller's own — so a holder
// name could only ever repeat the caller back at themselves, and joining
// `managers` to produce one would put another operator's name on a wire that
// never needed it. `claimedAt` stays: WHEN is still a fact about the place.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  checkSuperAdmin,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { placeIdsWithDirectOwner } from "../_shared/place-claim.ts";
import { ratesFromPlace, strategyForRates } from "../_shared/promo-strategy.ts";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceRequested,
  isPlaceSeeded,
} from "../_shared/place-state.ts";
import { isPaidPlan } from "../_shared/membership-enforcement-helpers.ts";
import {
  LIVE_MEMBERSHIP_STATES,
  MEMBERSHIP_PLAN_KEY,
} from "../_shared/partner-membership.ts";
import {
  type FunctionState,
  operatorFunctionStates,
} from "../_shared/schema-catalog.ts";
import { chunked, ID_CHUNK } from "../_shared/postgrest.ts";

type Body = {
  scope?: "all" | "mine" | "public";
  query?: string;
  limit?: number;
};

const MAX_LIMIT = 100;

/** The place half of the row. Kept to columns that already exist on
 *  `places` — this endpoint adds no schema and computes no new fact. */
const PLACE_PROFILE_EMBED =
  "name, address, zone, photos, enriched_at, request_count, business_state, " +
  "google_place_id, orders_enabled, pickup_orders_enabled, " +
  "delivery_orders_enabled, reservations_enabled, mesita_pay_enabled, " +
  "credits_enabled, enrichment";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const scope = body.scope === "mine" || body.scope === "all"
    ? body.scope
    : "public";
  const limit = Math.min(Math.max(body.limit ?? 50, 1), MAX_LIMIT);
  const search = (body.query ?? "").trim();

  const admin = adminClient(envRes.env);

  // The caller's portfolio, and the pool predicate's owner set. Both are
  // needed before the query can be shaped, and neither depends on the other.
  const [myMemberships, superAdmin, directOwners] = await Promise.all([
    admin
      .from("place_members")
      .select("place_id, role")
      .eq("manager_id", authRes.user.id),
    checkSuperAdmin(admin, authRes.user),
    placeIdsWithDirectOwner(admin),
  ]);
  if (myMemberships.error) {
    return json({ ok: false, error: myMemberships.error.message }, 500);
  }
  // The caller's own role per place, not just the id set: the console's
  // Settings and the Team surface both need to know whether THIS reader is an
  // owner, and the rail draws from the same payload. One read answers both.
  const myRoleByPlace = new Map<string, "owner" | "editor" | "viewer">();
  for (
    const r of (myMemberships.data ?? []) as {
      place_id: string;
      role: "owner" | "editor" | "viewer";
    }[]
  ) myRoleByPlace.set(r.place_id, r.role);
  const myPlaceIds = new Set(myRoleByPlace.keys());

  // Everything but the open pool is a MEMBERSHIP read, and both membership
  // scopes ship the full fact set — to a caller who has proved they are a
  // business. See "WHAT PROVES A BUSINESS CALLER NOW" in the header.
  const memberScope = (scope === "mine" || scope === "all") &&
    (superAdmin || myPlaceIds.size > 0);

  let q = admin
    .from("places")
    // `plan` is a places column, not a profile one — Partner is
    // `isPaidPlan(plan)` and needs no extra read. The four rate columns ride
    // beside it for the same reason (MESITA-1882): Rewards (the giving-back
    // dial, not the Member Visits card) is not a boolean anywhere in this
    // schema, it is the strategy those four rates spell, and `zero` IS off.
    .select(
      `id, state, content_state, claimed_at, plan, ` +
        `welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, ` +
        // WHAT THE ORGANIZATION USED TO CARRY (MESITA-1892). The legal person,
        // the Partner entitlement and the currency were columns on a row above
        // the place; they are columns ON it now, so they cost no extra read —
        // they ride the select that was already happening. Withheld per row
        // below, not here: a pool row must not leak a venue's RFC.
        `partnered, legal_name, rfc, currency, ` +
        `place_profiles!inner(${PLACE_PROFILE_EMBED})`,
    )
    .limit(limit);

  const mineList = [...myPlaceIds];
  if (scope === "mine") {
    if (mineList.length === 0) {
      return json({ ok: true, scope, places: [] });
    }
    q = q.in("id", mineList);
  } else if (scope === "all") {
    // "all" — held by ME, or held by nobody. PostgREST `or` takes one string;
    // `is.null` is the null test, not `eq.null`. With no memberships there is
    // no id list to build (`id.in.()` is not valid), and the union collapses
    // to the pool half.
    q = mineList.length === 0
      ? q.is("claimed_at", null)
      : q.or(`id.in.(${mineList.join(",")}),claimed_at.is.null`);
  } else {
    q = q.is("claimed_at", null);
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
    claimed_at: string | null;
    plan: string | null;
    welcome_free_rate: number | null;
    welcome_premium_rate: number | null;
    free_rate: number | null;
    premium_rate: number | null;
    partnered: boolean | null;
    legal_name: string | null;
    rfc: string | null;
    currency: string | null;
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
      enrichment: { functions?: Record<string, FunctionState> } | null;
    };
  };
  let rows = (data ?? []) as unknown as Row[];

  /** The shared pool predicate, per row: nobody owns it and nobody ever
   *  claimed it. `claimed_at is null` alone is not enough — a place owned the
   *  OLD way (created, then verified into an owner row) never passed through
   *  the pool and would sit in it looking free. */
  const isHeld = (r: Row) => r.claimed_at !== null || directOwners.has(r.id);

  /** May THIS reader see the held-only facts of THIS place?
   *
   *  Narrower than `memberScope` on purpose. `memberScope` asks "has the caller
   *  proved they are a business", which is enough for commercial facts like
   *  Partner and Verified. The legal person behind a venue — its RFC, its legal
   *  name, what it pays Mesita — belongs to the people who hold it, so it is
   *  gated on a `place_members` row for THAT place. A super-admin holds none
   *  and sees all, the same bypass every other business endpoint grants. */
  const canSeeHeldFacts = (id: string) => superAdmin || myPlaceIds.has(id);

  // Wherever unheld rows appear, they must satisfy that predicate. On "all"
  // the filter must spare the caller's OWN rows, which are held by definition
  // and would otherwise vanish from their own list.
  if (scope === "public" || scope === "all") {
    rows = rows.filter((r) => myPlaceIds.has(r.id) || !isHeld(r));
  }

  // VERIFIED is ownership PROOF — an approved place_verifications row, the
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
        .from("place_verifications")
        .select("place_id")
        .eq("state", "approved")
        .in("place_id", idPart);
      if (vErr) {
        console.error("[list-places] place_verifications:", vErr.message);
        verified = null;
        break;
      }
      for (const v of (vs ?? []) as { place_id: string }[]) {
        verified.add(String(v.place_id));
      }
    }
  }

  // THE BILLING BEHIND `partnered`, for the places the caller actually holds.
  // At most one live row per place by construction (`partner_memberships_one_live`
  // is a unique partial index on exactly these two states), so this is a map,
  // not a list. Best-effort like `verified`: a failed read leaves the map empty
  // and every row ships `membership: null`, which every consumer already has to
  // treat as "became a partner some other way" rather than as "not a partner".
  const heldIds = rows.map((r) => r.id).filter((id) => canSeeHeldFacts(id));
  const membershipByPlace = new Map<string, {
    state: string;
    renewsAt: string | null;
    cancelAtPeriodEnd: boolean;
  }>();
  if (heldIds.length > 0) {
    for (const idPart of chunked(heldIds, ID_CHUNK)) {
      const { data: ms, error: mErr } = await admin
        .from("partner_memberships")
        .select("place_id, state, current_period_end, cancel_at_period_end")
        .in("place_id", idPart)
        .in("state", LIVE_MEMBERSHIP_STATES);
      if (mErr) {
        console.error("[list-places] partner_memberships:", mErr.message);
        membershipByPlace.clear();
        break;
      }
      for (
        const m of (ms ?? []) as {
          place_id: string;
          state: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
        }[]
      ) {
        membershipByPlace.set(m.place_id, {
          state: m.state,
          renewsAt: m.current_period_end,
          cancelAtPeriodEnd: m.cancel_at_period_end === true,
        });
      }
    }
  }

  // ONE PRICE FOR THE WHOLE CONSOLE, off `membership_plans` — the same row the
  // Stripe price is provisioned from, so what an owner reads is what Stripe
  // bills. It is a CATALOG fact, not a place's, so it rides the envelope
  // rather than every row. It used to reach the console on the organizations
  // payload; that payload is gone and this is the call that replaced it.
  let membershipPrice: { priceCents: number; currency: string } | null = null;
  if (memberScope) {
    const { data: plan, error: planErr } = await admin
      .from("membership_plans")
      .select("price_cents, currency")
      .eq("key", MEMBERSHIP_PLAN_KEY)
      .maybeSingle();
    if (planErr) {
      console.error("[list-places] membership_plans:", planErr.message);
    } else if (plan) {
      const row = plan as { price_cents: number; currency: string };
      membershipPrice = { priceCents: row.price_cents, currency: row.currency };
    }
  }

  return json({
    ok: true,
    scope,
    // THE SHELL'S ENVELOPE (MESITA-1892). These two are console-wide facts, not
    // facts about any place, and they reached the shell on the organizations
    // payload until that endpoint was deleted. They ride here because this is
    // the one call the shell already makes, and a second round trip to learn
    // whether the Admin row exists would be a round trip per render.
    isSuperAdmin: superAdmin,
    membershipPrice,
    places: rows.map((r) => {
      const p = r.place_profiles;
      return {
        id: r.id,
        name: p.name,
        address: p.address,
        zone: p.zone,
        claimedAt: r.claimed_at,
        // ONE url. See rule 1 in the header.
        photoUrl: Array.isArray(p.photos) && p.photos.length > 0
          ? p.photos[0]
          : null,
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
        // Owned — somebody holds this place. It is the pool predicate read
        // the other way round, so the one fact cannot answer differently to
        // the list and to the claim.
        owned: isHeld(r),
        // Partner — plan !== free. Withheld on the pool: what an unheld place
        // pays is not a guest's business.
        partner: memberScope ? isPaidPlan(r.plan) : undefined,
        // Verified — approved ownership proof. `undefined` when withheld OR
        // when the lookup failed, so the console says "?" instead of "no".
        verified: verified ? verified.has(r.id) : undefined,
        // The per-function map (MESITA-1687, reversing MESITA-1637) — same
        // fold admin-web-search-places already ships as `enrich_functions`.
        // Withheld on the pool for the SAME reason as partner/verified
        // (header rule 4): scope=public is reachable by any consumer
        // account, and "ship it to everyone" (Pato, 2026-09-08) meant every
        // BUSINESS browser, not every signed-in consumer. Guarded past that:
        // a place with no enrichment row yet, or one whose `functions` key
        // is missing, must render "?" per row, not throw.
        enrichFunctions: memberScope && p.enrichment &&
            typeof p.enrichment.functions === "object" &&
            p.enrichment.functions !== null
          ? operatorFunctionStates(p.enrichment.functions)
          : undefined,
        // The Rewards dial — the one commercial fact with NO column of its own
        // (MESITA-1882). It is the strategy the four rate columns spell, and
        // `zero` is off: a member may sit on Zero deliberately (Docs › Rewards
        // §C, "membership stays, discounts pause"). Derived through the SAME
        // `strategyForRates` the partner derivation uses, never a second copy
        // of the preset tuples — if these two ever disagree, a place reads
        // Enabled here while the consumer app withholds its Partner badge,
        // which is the exact bug this field exists to close.
        //
        // The BOOLEAN ships, never the rates. What a place pays has never
        // been on this wire and does not start now; the console only needs
        // "is it on". Withheld on the pool with `partner` and `verified`
        // (header rule 4) — same class of commercial fact, same clearance.
        visitRewards: memberScope
          ? (() => {
            const strategy = strategyForRates(ratesFromPlace(r));
            return strategy !== null && strategy !== "zero";
          })()
          : undefined,
        // The commercial rails, exactly the columns that exist.
        orders: p.orders_enabled === true,
        pickupOrders: p.pickup_orders_enabled === true,
        deliveryOrders: p.delivery_orders_enabled === true,
        reservations: p.reservations_enabled === true,
        mesitaPay: p.mesita_pay_enabled === true,
        credits: p.credits_enabled === true,
        // ── HELD ONLY ───────────────────────────────────────────────────
        //
        // What the organization row carried, on the place that carries it
        // now. `undefined`, never null, on a row this reader does not hold:
        // absent says "not shipped", null would say "read and empty", and the
        // console renders those differently.
        ...(canSeeHeldFacts(r.id)
          ? {
            myRole: myRoleByPlace.get(r.id),
            legalName: r.legal_name,
            rfc: r.rfc,
            currency: r.currency ?? "MXN",
            partnered: r.partnered === true,
            // THE ONE PAY BIT (MESITA-1892). Same column as `mesitaPay`
            // above, shipped again under the name the held surface reads it
            // by — the org half was folded into it, so there is one switch
            // and both names answer from it rather than from two columns
            // that could disagree.
            mesitaPayEnabled: p.mesita_pay_enabled === true,
            membership: membershipByPlace.get(r.id) ?? null,
            plan: r.plan ?? "free",
          }
          : {}),
      };
    }),
  });
});
