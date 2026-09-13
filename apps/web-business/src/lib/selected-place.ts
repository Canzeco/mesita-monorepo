// THE SELECTED PLACE — the console's memory, read once per request
// (MESITA-1832).
//
// The six pages carry no id (/profile, /reviews, …). Which place and which
// organization they are about is the same answer the rail gives
// (lib/rail-scope.ts, client): the place remembered in the rail cookie, held
// by an organization of the viewer's — else the remembered (or first)
// organization's first place. A remembered place NO organization of the
// viewer's holds is a pool place opened from the list: it is selected as
// FOREIGN and the place layout shows it read-only (Profile alone), exactly
// as /places/<id> did.
//
// `cache()`d so the (place) layout and the page beneath it pay one read.
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations, type Organization } from "@/lib/api/organizations";
import { findHolder, findOrg, pickPlace, preferredOrg } from "@/lib/active-organization";
import { RAIL_ORG_COOKIE, RAIL_PLACE_COOKIE, plausibleId } from "@/lib/sidebar-prefs";

export type Selection = {
  organizations: Organization[];
  /** The selected organization. Null only with no membership. */
  org: Organization | null;
  /** The selected place's id. Null when the organization holds none. */
  placeId: string | null;
  /** True when `placeId` is held by no organization of the viewer's: a pool place. */
  foreign: boolean;
};

export const getSelection = cache(async (): Promise<Selection> => {
  const supabase = await createServerSupabase();
  const organizations = await apiListOrganizations(supabase);
  const jar = await cookies();
  const rememberedPlaceId = plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value);
  const rememberedOrgId = plausibleId(jar.get(RAIL_ORG_COOKIE)?.value);

  // The holder wins, whatever organization was remembered — the same rule
  // the rail applies to a place route.
  const held = findHolder(organizations, rememberedPlaceId);
  if (held) {
    return { organizations, org: held.org, placeId: held.place.id, foreign: false };
  }
  const org = findOrg(organizations, rememberedOrgId) ?? preferredOrg(organizations, rememberedOrgId);
  if (rememberedPlaceId) {
    // Remembered but held by nobody I am in: a pool place, or a released
    // one. The place layout asks get-place; a 404 there ends the visit.
    return { organizations, org, placeId: rememberedPlaceId, foreign: true };
  }
  const place = org ? pickPlace(org) : null;
  return { organizations, org, placeId: place?.id ?? null, foreign: false };
});
