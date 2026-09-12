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
      .select("role, organizations!inner(id, name, legal_name, rfc, currency)")
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
    };
  };
  const list = (rows ?? []) as unknown as Row[];
  const ids = list.map((r) => r.organizations.id);

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
    place_profiles: Profile;
  };
  type RailPlace = { id: string; name: string; photoUrl: string | null };
  const byOrg = new Map<string, RailPlace[]>();
  if (ids.length) {
    const { data: places, error: placesErr } = await admin
      .from("places")
      .select("id, organization_id, place_profiles!inner(name, photos)")
      .in("organization_id", ids);
    if (placesErr) return json({ ok: false, error: placesErr.message }, 500);
    const railRows = ((places ?? []) as PlaceRow[])
      .map((p) => ({
        organizationId: p.organization_id,
        place: {
          id: p.id,
          name: p.place_profiles.name,
          photoUrl: Array.isArray(p.place_profiles.photos) &&
              p.place_profiles.photos.length > 0
            ? p.place_profiles.photos[0]
            : null,
        } satisfies RailPlace,
      }))
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
    organizations: list.map((r) => {
      const places = byOrg.get(r.organizations.id) ?? [];
      return {
        id: r.organizations.id,
        name: r.organizations.name,
        legalName: r.organizations.legal_name,
        rfc: r.organizations.rfc,
        currency: r.organizations.currency,
        myRole: r.role,
        placeCount: places.length,
        places,
      };
    }),
  });
});
