// The console root — the resolver (MESITA-1807, Pato D3 2026-09-12).
//
// It used to BE the Organization screen, then a forwarding address to it.
// Now it lands where an operator actually works: the last place they opened
// (a cookie, searched across every organization they are in), else their
// organization's first place, else that organization's Overview, else Create
// — and only from a SUCCESSFUL empty list; a failed read throws through
// `cache()` into `(shell)/error.tsx`, never into the create branch.
//
// TEMPORARY, NOT PERMANENT, and that is the whole point of doing it this way.
// `redirect()` answers 307, so nothing caches `/` as "always goes to X":
// where it lands depends on which place was opened last.
//
// THE QUERY STRING TRAVELS — and `?connect=` short-circuits. Stripe stores
// an Account Link's return_url when the link is minted, so a link created
// before MESITA-1727 shipped still points at `/?org=<id>&connect=return`.
// A place Profile has no return notice; Payments does. So a `?connect=`
// arrival goes to that organization's Payments with the rest of the query,
// before any place is considered. `org` is consumed here and dropped from
// what is forwarded; everything else rides along untouched.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import {
  findOrg,
  preferredOrg,
  resolveLanding,
} from "@/lib/active-organization";
import {
  SHELL_ROUTES,
  orgHref,
  placeHref,
  withQuery,
} from "@/lib/console-routes";
import {
  RAIL_ORG_COOKIE,
  RAIL_PLACE_COOKIE,
  plausibleId,
} from "@/lib/sidebar-prefs";

export const dynamic = "force-dynamic";

export default async function ConsoleRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { org: requestedOrg, ...rest } = sp;
  const requested = Array.isArray(requestedOrg) ? requestedOrg[0] : requestedOrg;

  const supabase = await createServerSupabase();
  const organizations = await apiListOrganizations(supabase);

  const jar = await cookies();
  const rememberedPlaceId = plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value);
  const rememberedOrgId = plausibleId(jar.get(RAIL_ORG_COOKIE)?.value);

  if (typeof sp.connect === "string") {
    const org =
      findOrg(organizations, requested) ??
      preferredOrg(organizations, rememberedOrgId);
    if (org) redirect(withQuery(orgHref(org.id, "payments"), rest));
  }

  const landing = resolveLanding({
    organizations,
    rememberedPlaceId,
    rememberedOrgId: findOrg(organizations, requested)?.id ?? rememberedOrgId,
  });
  const target =
    landing.kind === "place"
      ? placeHref(landing.placeId)
      : landing.kind === "org"
        ? orgHref(landing.orgId)
        : SHELL_ROUTES.orgNew;
  redirect(withQuery(target, rest));
}
