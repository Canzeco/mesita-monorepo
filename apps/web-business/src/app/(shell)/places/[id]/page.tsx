// The bare place URL is Profile's front door (MESITA-1732) — and, since
// MESITA-1892, the one address that catches Stripe's stored `?connect=`.
//
// THAT SECOND JOB USED TO BE `/orgs/<id>`'s. Stripe stores an Account Link's
// `return_url` when the link is MINTED, so links created months ago land on
// whatever address was canonical then, forever. The organization is gone, so
// `next.config.ts` forwards every `/orgs/…` arrival to `/`, which resolves the
// remembered place and sends it here — and links minted from now on name this
// address directly (`(shell)/actions/place-setup.ts`).
//
// A `?connect=` arrival goes to `products/pay` with the WHOLE query: that is
// where the Stripe account and the notice that reads `?connect=` both live.
// Dropping the query would strand an owner who just spent eight minutes
// uploading documents on a screen that does not know they came back.
//
// TEMPORARY, not permanent: Profile is where a place opens today, and a 308
// would cache that choice — and the connect branch, which is not a choice at
// all — in every browser forever.
import { redirect } from "next/navigation";
import { placePayHref, withQuery } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

export const dynamic = "force-dynamic";

export default async function PlaceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (typeof sp.connect === "string") {
    redirect(withQuery(placePayHref(id), sp));
  }
  redirect(withQuery(placeTabHref(id, "profile"), sp));
}
