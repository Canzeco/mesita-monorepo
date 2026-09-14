// `/orgs/<id>` — THE BARE ADDRESS, and a forwarder onto the page that names
// itself (MESITA-1846).
//
// Pato, 2026-09-14, writing the routing out himself:
//
//   org/orgid/organization
//   org/orgid/activity
//   org/orgid/places
//
// Two of those three already were that. THE RAIL DRAWS ITS FIVE ORGANIZATION
// ROWS AS SIBLINGS, and four of them were named addresses while one was a raw
// uuid — an operator reading the URL bar met `…/activity`, `…/places`,
// `…/payments`, `…/customers`, and then an id that could be a container, a
// redirect or a page. Symmetry in the address bar is worth the one repeated
// noun MESITA-1842 deleted this segment over.
//
// THE BARE ADDRESS STAYS LIVE, because it has a second job nothing else can
// do. STRIPE stores an Account Link's `return_url` when the link is MINTED, so
// links created months ago point at `/orgs/<id>?connect=return` and land here
// forever. That branch is checked FIRST and forwards the WHOLE query to
// Payments, where the notice that reads `?connect=` lives — dropping the query
// would strand an owner on a screen that knows neither which organization they
// onboarded nor that they just came back.
//
// TEMPORARY, never permanent. Where this page lives has moved three times in
// one day (MESITA-1841 → 1842 → 1846), and a 308 caches today's answer in
// every browser that follows it, forever. That is exactly how `/settings` took
// a live page down for a day (MESITA-1839).
//
// NO AUTH CHECK AND NO READ HERE. A forwarder that fetches is a round trip
// bought for nothing: the page it forwards to does both, and `orgs/[orgId]/
// layout.tsx` above has already refused a foreign id.
import { redirect } from "next/navigation";
import { orgHref, withQuery } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function OrgRootPage(props: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (typeof sp.connect === "string") {
    redirect(withQuery(orgHref(orgId, "payments"), sp));
  }
  redirect(withQuery(orgHref(orgId, "settings"), sp));
}
