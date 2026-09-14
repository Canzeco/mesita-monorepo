// The flat address for the organization's activity page — a resolver
// (lib/flat-address).
//
// IT RESOLVES AN ORGANIZATION NOW, not a place. Activity was a place view
// until MESITA-1841 and this file forwarded to `/places/<id>/activity`; the
// page moved up a scope, so the resolver follows it. `/places/<id>/activity`
// forwards here from next.config.ts, which is how every bookmark to the old
// view still lands on the numbers it was bookmarked for.
import { resolveOrgPage } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolveOrgPage("activity", await searchParams);
}
