// Supabase Edge Function — business-web-list-organizations
//
// The organizations the caller belongs to, each with the places it holds,
// plus whether the caller is a super-admin. One account may be in many
// organizations (organization_members is M:N), so the console needs this to
// render its switcher — and, since MESITA-1779, its whole left rail.
//
// THE RAIL'S PLACES RIDE THIS PAYLOAD. The rail used to list the portfolio
// through a second call after hydration (a server action onto
// business-web-list-places, the full states-matrix endpoint, p50 399 ms), so
// the places popped in one round trip after the frame — or never, when that
// call failed. The places query below already ran for `placeCount`; it now
// returns the three fields a rail row draws (id, name, first photo) and the
// console paints the portfolio on the first frame for the price of the
// columns. `placeCount` stays on the wire for the Organization screen.
//
// `photoUrl` is `photos[0]`, ONE string, the same rule business-web-list-places
// applies. It is a full-resolution original: the console renders it through
// placeThumbUrl(), never straight into an <img>.
//
// `isSuperAdmin` rides along because the rail derives which of a place's four
// views a viewer may open (Admin is super-admin only) without visiting it.
//
// THE MEMBERSHIP RIDES IT TOO (MESITA-1877). `partnered` is the entitlement,
// and it is all most readers need; `membership` is the BILLING behind it —
// renewal date, whether it is cancelling, and whether Stripe is dunning — so
// the Products page can print "Renews 14 Sep 2027" instead of "Renews yearly"
// and say "Payment due" without a second round trip. It is null for an
// organization that was made a partner some other way (the operator switch, a
// migration): partnered true with membership null is a real state, not a bug.
// `membershipPrice` is the CATALOG price, the same row Stripe's price is
// provisioned from, so the console stops carrying a hardcoded label.
//
// Auth: any signed-in account. The list is scoped to the caller's own
// memberships, so there is nothing to gate beyond a session.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  checkSuperAdmin,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import {
  LIVE_MEMBERSHIP_STATES,
  MEMBERSHIP_PLAN_KEY,
} from "../_shared/partner-membership.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  // Deterministic order matters: the console's default org is list[0]
  // (resolveActiveOrg fallback), and the day someone else can add you to an
  // organization, Postgres row order would otherwise silently decide which
  // org your home screen — and its Stripe connect button — points at.
  //
  // The super-admin check is independent of the membership rows, so the two
  // reads share one wait rather than paying for each other.
  const [membership, isSuperAdmin] = await Promise.all([
    admin
      .from("organization_members")
      .select(
        "role, organizations!inner(id, name, legal_name, rfc, currency, partnered, mesita_pay_enabled)",
      )
      .eq("manager_id", authRes.user.id)
      .order("created_at", { ascending: true }),
    checkSuperAdmin(admin, authRes.user),
  ]);
  const { data: rows, error } = membership;
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    role: string;
    organizations: {
      id: string;
      name: string;
      legal_name: string | null;
      rfc: string | null;
      currency: string;
      partnered: boolean;
      mesita_pay_enabled: boolean;
    };
  };
  const list = (rows ?? []) as unknown as Row[];
  const ids = list.map((r) => r.organizations.id);

  // The live Membership per organization, and the catalog price. Both are
  // small, independent reads, so they share one wait with each other — but
  // NOT with the places query below, which the rail blocks on.
  //
  // A FAILED READ IS NOT "NO MEMBERSHIP". Either read failing leaves its map
  // empty and the payload ships `membership: null`, which the console reads
  // as "billing unknown" and falls back to the plain yearly line — the same
  // shape a partner from another door already produces. Nothing here may fail
  // the whole call: the rail, the switcher and the create form all ride this
  // payload, and a billing read must never be what takes them down.
  type MembershipRow = {
    organization_id: string;
    state: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  const membershipByOrg = new Map<string, MembershipRow>();
  let membershipPrice: { priceCents: number; currency: string } | null = null;
  if (ids.length) {
    const [memberships, plan] = await Promise.all([
      admin
        .from("partner_memberships")
        .select(
          "organization_id, state, current_period_end, cancel_at_period_end",
        )
        .in("organization_id", ids)
        .in("state", LIVE_MEMBERSHIP_STATES),
      admin
        .from("org_plans")
        .select("price_cents, currency")
        .eq("key", MEMBERSHIP_PLAN_KEY)
        .maybeSingle(),
    ]);
    if (memberships.error) {
      console.error(
        "[business-web-list-organizations] partner_memberships:",
        memberships.error,
      );
    } else {
      for (const row of (memberships.data ?? []) as MembershipRow[]) {
        membershipByOrg.set(row.organization_id, row);
      }
    }
    const planRow = plan.data as
      | { price_cents: number; currency: string | null }
      | null;
    if (planRow) {
      membershipPrice = {
        priceCents: planRow.price_cents,
        currency: (planRow.currency ?? "MXN").toUpperCase(),
      };
    }
  }

  // Every held place in one round trip, then grouped in memory — cheaper
  // than a query per organization, and it is the same read the count used
  // to be. `name` and `photos` live on place_profiles (generated display
  // name, MESITA-1593); selecting them off `places` 42703s
  // (MESITA-1781). Same embed business-web-list-places uses. Sort in
  // memory: `.order("name")` on `places` is the same missing column.
  type Profile = { name: string; photos: string[] | null };
  type PlaceRow = {
    id: string;
    organization_id: string;
    // Generated types type a 1:1 embed as an array; live PostgREST
    // returns an object. Accept both, same as business-web-list-places
    // going through `unknown`.
    place_profiles: Profile | Profile[];
  };
  type RailPlace = { id: string; name: string; photoUrl: string | null };
  const byOrg = new Map<string, RailPlace[]>();
  if (ids.length) {
    const { data: places, error: placesErr } = await admin
      .from("places")
      .select("id, organization_id, place_profiles!inner(name, photos)")
      .in("organization_id", ids);
    if (placesErr) return json({ ok: false, error: placesErr.message }, 500);
    const railRows = ((places ?? []) as unknown as PlaceRow[])
      .map((p) => {
        const profile = Array.isArray(p.place_profiles)
          ? p.place_profiles[0]
          : p.place_profiles;
        return {
          organizationId: p.organization_id,
          place: {
            id: p.id,
            name: profile?.name ?? "",
            photoUrl: Array.isArray(profile?.photos) &&
                profile.photos.length > 0
              ? profile.photos[0]
              : null,
          } satisfies RailPlace,
        };
      })
      .sort((a, b) =>
        (a.place.name ?? "").localeCompare(b.place.name ?? "")
      );
    for (const r of railRows) {
      const bucket = byOrg.get(r.organizationId) ?? [];
      bucket.push(r.place);
      byOrg.set(r.organizationId, bucket);
    }
  }

  return json({
    ok: true,
    isSuperAdmin,
    membershipPrice,
    organizations: list.map((r) => {
      const places = byOrg.get(r.organizations.id) ?? [];
      const membership = membershipByOrg.get(r.organizations.id) ?? null;
      return {
        id: r.organizations.id,
        name: r.organizations.name,
        legalName: r.organizations.legal_name,
        rfc: r.organizations.rfc,
        currency: r.organizations.currency,
        partnered: r.organizations.partnered === true,
        mesitaPayEnabled: r.organizations.mesita_pay_enabled === true,
        membership: membership
          ? {
            state: membership.state,
            renewsAt: membership.current_period_end,
            cancelAtPeriodEnd: membership.cancel_at_period_end === true,
          }
          : null,
        myRole: r.role,
        placeCount: places.length,
        places,
      };
    }),
  });
});
