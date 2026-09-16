// The console root — the resolver (MESITA-1807, Pato D3 2026-09-12).
//
// It used to BE the Organization screen, then a forwarding address to it.
// Now it lands where an operator actually works: the last place they opened
// (a cookie), else the first place they hold, else the catalogue — and only
// from a SUCCESSFUL empty list; a failed read throws through `cache()` into
// `(shell)/error.tsx`, never into the empty branch.
//
// TEMPORARY, NOT PERMANENT, and that is the whole point of doing it this way.
// `redirect()` answers 307, so nothing caches `/` as "always goes to X":
// where it lands depends on which place was opened last.
//
// THE QUERY STRING TRAVELS — and `?connect=` short-circuits. Stripe stores an
// Account Link's return_url when the link is MINTED, so links created months
// ago still point at `/?org=<id>&connect=return`, at `/organization?org=…`, or
// at `/orgs/<id>?connect=return` — and `next.config.ts` forwards the last two
// here, because this is the one address that reads the query.
//
// SO A `?connect=` ARRIVAL GOES STRAIGHT TO MESITA PAY (MESITA-1892). It used
// to go to the organization that owned the Stripe account; the account is the
// PLACE's now, so it goes to that place's `products/pay` — the page that holds
// the account and the notice that reads `?connect=`. `org` is consumed here
// and dropped from what is forwarded, since it names a table that no longer
// exists; everything else rides along untouched.
//
// WITH NO PLACE AT ALL a `?connect=` arrival lands on the catalogue like any
// other: there is no account to show, and Add place is the only honest next
// step.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiMyPlaces } from "@/lib/api/console";
import { resolveLanding } from "@/lib/active-place";
import { SHELL_ROUTES, placePayHref, withQuery } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { RAIL_PLACE_COOKIE, plausibleId } from "@/lib/sidebar-prefs";

export const dynamic = "force-dynamic";

export default async function ConsoleRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // `org` named an organization. The table is gone, so the value cannot be
  // resolved into anything — it is dropped rather than forwarded, which would
  // put a dead id in the address bar of the page it lands on.
  const { org: _goneWithTheLayer, ...rest } = sp;

  const supabase = await createServerSupabase();
  const places = await apiMyPlaces(supabase);

  const jar = await cookies();
  const rememberedPlaceId = plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value);

  const landing = resolveLanding({ places, rememberedPlaceId });

  if (typeof sp.connect === "string" && landing.kind === "place") {
    redirect(withQuery(placePayHref(landing.placeId), rest));
  }

  // Straight to the canonical address (MESITA-1839). `/` has just resolved
  // which place this is, so forwarding to the flat `/profile` would make it
  // resolve the same thing again one hop later.
  redirect(
    withQuery(
      landing.kind === "place"
        ? placeTabHref(landing.placeId, "profile")
        : SHELL_ROUTES.places,
      rest,
    ),
  );
}
