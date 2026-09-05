// The place catalog for the business console's Places layer.
//
// Why an `admin-web-*` EF from the business app: listing EVERY place —
// not just the ones you are a member of — is a platform-operator read,
// and `admin-web-search-places` is the one door that does it. It calls
// requireSuperAdmin, so this surface is super-admin-only for now, which
// is exactly the "pick any place, no membership needed" behaviour asked
// for. Every downstream write still goes through business-web-* EFs,
// where `requireMembership` bypasses for super-admins
// (_shared/auth-membership.ts:134) — so the existing console manages any
// place with no backend change.
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type CatalogPlace = {
  id: string;
  name: string;
  address: string | null;
  zone: string | null;
  // PLACE states only. "Partnered" is an ORGANIZATION state (it means the
  // operator has a live payment account), so it does not belong on a place.
  listed: boolean;
  verified: boolean;
};

/** The EF only guarantees id/name; everything else may be absent. */
type RawCatalogPlace = Pick<CatalogPlace, "id" | "name"> &
  Partial<Omit<CatalogPlace, "id" | "name">>;

export async function searchAnyPlaces(
  client: SupabaseClient,
  query: string,
  limit = 50,
): Promise<CatalogPlace[]> {
  const { places } = await invokeEF<{ places: RawCatalogPlace[] }>(
    client,
    "admin-web-search-places",
    { query, limit },
    "Couldn't load the place catalog.",
  );
  return (places ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address ?? null,
    zone: p.zone ?? null,
    listed: p.listed ?? false,
    verified: p.verified ?? false,
  }));
}
