// THE FLAT ADDRESSES — one resolver, one reader (MESITA-1842).
//
// Each flat name is a 307 onto the canonical address for the remembered place.
// They exist so the console keeps the scope-free URLs MESITA-1832 shipped: a
// bookmark, a typed address, an old link in a message and a Stripe return_url
// all still land, and the one-place owner who types `/profile` never meets an
// id.
//
// THEY ALL RESOLVE ONE SUBJECT NOW (MESITA-1892). Nine were a place's views
// and four were an organization's pages; the organization is gone and its four
// pages are the place's, so every flat name resolves the same remembered
// place. The two branches below differ only in which address they build —
// `/places/<id>/<view>` or `/places/<id>/<page>` — which is why they are two
// lines and not two mechanisms.
//
// THE RAIL DOES NOT LINK HERE. It links to the canonical address, which the
// shell has already resolved — so a rail click costs one hop, not two. These
// are for arrivals only.
//
// WITH NOTHING SELECTED THEY DO NOT FORWARD. A caller who holds no place has
// no `/places/<id>/…` to point at, so the page answers with the one next step
// (`NoPlaceYet`) instead of bouncing somewhere that is not about anything.
// That is MESITA-1833's law kept intact: every rail row is a live link that
// lands on a real next step, never a dead or disabled one.
//
// The QUERY TRAVELS. Stripe stores an Account Link's return_url when the link
// is MINTED, so links minted while `/payments` was canonical still arrive here
// with `?connect=`, and the notice that reads it lives on the page this
// forwards to.
import { redirect } from "next/navigation";
import { NoPlaceYet } from "@/components/console/NoPlaceYet";
import { getSelection } from "@/lib/selected-place";
import { PLACE_TABS, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import {
  FLAT_ROUTES,
  placePageHref,
  withQuery,
  type PlacePage,
} from "@/lib/console-routes";

type Search = Record<string, string | string[] | undefined>;

const isPlaceTab = (n: string): n is PlaceTab =>
  (PLACE_TABS as readonly string[]).includes(n);

/** Resolve ONE flat name, or null when the contract does not claim it.
 *
 *  Null means 404, never a generic page: a resolver that quietly serves every
 *  typo is how `/setting` ends up looking real. The vocabulary is `FLAT_ROUTES`
 *  itself — the same constant the tests walk and `next.config.ts` is checked
 *  against — so a name cannot be live here and dead there, which is the drift
 *  ten hand-written directories invited (MESITA-1842). */
export async function resolveFlat(name: string, sp: Search = {}) {
  if (!(name in FLAT_ROUTES)) return null;
  if (isPlaceTab(name)) return resolvePlaceView(name, sp);
  return resolvePlacePage(name as PlacePage, sp);
}

/** Forward to the remembered place's VIEW, or answer with the next step. */
export async function resolvePlaceView(tab: PlaceTab, sp: Search = {}) {
  const { placeId } = await getSelection();
  if (placeId) redirect(withQuery(placeTabHref(placeId, tab), sp));
  return <NoPlaceYet />;
}

/** Forward to the remembered place's PAGE, or answer with the next step. */
export async function resolvePlacePage(page: PlacePage, sp: Search = {}) {
  const { placeId } = await getSelection();
  if (placeId) redirect(withQuery(placePageHref(placeId, page), sp));
  return <NoPlaceYet />;
}
