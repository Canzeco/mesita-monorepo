// The place tab vocabulary — names, labels, hrefs. Nothing else.
//
// This is split out of `place-view.ts` deliberately (MESITA-1558). That module
// also holds a `cache()`d server read, and it reaches `place-manage/actions`
// -> `lib/supabase-ef` -> `lib/supabase/server`. A "use client" tab row that
// imports the vocabulary from there drags the whole server data layer into its
// bundle graph.
//
// Keep this file free of server imports. It is the half a client component may
// have.
import { PLACE_BASE } from "@/lib/place-base";

// THE MVP FIRST STAGE IS TWO VIEWS (MESITA-2088): Profile is the profile
// editor, Admin holds the facts and the Create/Enrich/Update buttons.
//
// Profile has its own segment (MESITA-1732): the bare place URL is a temporary
// redirect onto it, so the view an operator is most likely to link to has a
// link.
export const PLACE_TABS = ["profile", "reviews", "preview", "admin"] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  reviews: "Reviews",
  preview: "Preview",
  admin: "Admin",
};

/** A view's address. No organization rides along any more (MESITA-1807), and
 *  since MESITA-1892 there is none to ride: the place id is the whole scope,
 *  and the rail reads it off the pathname. */
export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `${PLACE_BASE}/${encodeURIComponent(placeId)}/${tab}`;
}

/** Which view a place pathname is showing, or null if it is not one.
 *
 *  ONE reader for the segment→tab rule. It used to be written twice, in the
 *  rail and in the page heading, both as `split("/")[3] ?? "profile"` — the
 *  `??` being the bare-URL special case. Two copies of a routing rule is one
 *  copy too many, and the fallback is now a lie: the bare URL redirects rather
 *  than rendering Profile.
 *
 *  Returns null for anything that is not a known tab, so a future segment
 *  cannot silently light up the Profile row. */
export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const seg = pathname.split("/")[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "")
    ? (seg as PlaceTab)
    : null;
}
