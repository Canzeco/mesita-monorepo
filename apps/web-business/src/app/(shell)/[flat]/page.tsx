// THE FLAT ADDRESSES, in ONE file (MESITA-1842).
//
// `/profile`, `/menus`, `/reviews`, `/visits`, `/orders`, `/reservations`,
// `/pay`, `/credits`, `/admin`, `/settings`, `/products`, `/customers`,
// `/activity` — each a 307 onto the canonical address for the remembered
// place. They were ten directories holding one line each, and adding the
// eleventh meant remembering to create a directory, a page and a loading
// boundary that no compiler would have missed.
//
// THIRTEEN NAMES, ONE SUBJECT (MESITA-1892). Four of them used to resolve an
// ORGANIZATION and nine a place; the organization is gone and its four pages
// are the place's, so every name here resolves the same remembered place.
//
// WHY A DYNAMIC SEGMENT IS SAFE HERE. Next resolves STATIC segments before
// dynamic ones, so `/account`, `/places`, `/places/…`, `/signin` and `/add`
// still win — this only ever sees a name nothing else claimed. A name that is
// not in the contract answers 404 rather than rendering something generic: a
// catch-all that quietly serves every typo is how `/setting` ends up looking
// like a real page.
//
// THE RAIL DOES NOT LINK HERE. It links to the canonical address, which the
// shell has already resolved — so a rail click costs one hop, not two. These
// are for arrivals: a bookmark, a typed address, an old link in a message, a
// Stripe return URL.
//
// WITH NOTHING SELECTED THEY DO NOT FORWARD. A caller holding no place has no
// `/places/<id>/…` to point at, so the page answers with the one next step
// (`NoPlaceYet`) instead of bouncing somewhere that is not about anything —
// MESITA-1833's law that every row lands on a real next step.
import { notFound } from "next/navigation";
import { resolveFlat } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatPage({
  params,
  searchParams,
}: {
  params: Promise<{ flat: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ flat }, sp] = await Promise.all([params, searchParams]);
  const resolved = await resolveFlat(flat, sp);
  if (resolved === null) notFound();
  return resolved;
}
