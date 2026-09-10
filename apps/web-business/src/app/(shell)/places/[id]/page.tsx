// The bare place URL. It used to BE the Profile view; Profile has its own
// address now (MESITA-1732), so this is a forwarding address and nothing else.
//
// Why it moved: Profile was /places/<id> while its three siblings were real
// segments, so /places/<id>/profile answered 404. The one view an operator is
// most likely to send a colleague a link to was the one view with no link.
// Same defect MESITA-1727 fixed for the Organization screen, same shape here.
//
// TEMPORARY, NOT PERMANENT. `redirect()` answers 307, so nothing caches
// /places/<id> as "always goes to /profile". A `permanent: true` entry in
// next.config.ts would answer 308, which browsers keep on disk with no expiry,
// and this is the path a place's canonical URL should be free to become again.
// legacy-redirects.test.ts:90 asserts every next.config redirect is permanent,
// which is a second reason this belongs here and not there.
//
// THE QUERY STRING TRAVELS. Every rail href carries ?org=<id>. Drop it and a
// multi-org operator who followed a bookmark is silently switched to
// organizations[0] — and then every other nav href follows that wrong org.
//
// This route is deliberately NOT linked from anywhere inside the app: the four
// legacy 308s in next.config point straight at /profile, and placeTabHref never
// returns the bare base. Only bookmarks and pasted links land here, which
// matters because loading.tsx paints the Profile skeleton for the whole [id]
// segment, so a hop through this page flashes that skeleton twice.
import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";
import { withQuery } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function PlaceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // placeTabHref, not a hand-built string: it is the one place that knows a
  // tab's shape, and it already carries ?org= when given one. Here the org
  // rides in `sp` instead, so pass null and let withQuery forward the lot.
  redirect(withQuery(placeTabHref(id, "profile"), sp));
}
