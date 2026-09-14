// The flat address for the organization's own page — a resolver
// (lib/flat-address).
//
// `/organization` was a legacy 308 to `/` for two days (MESITA-1807 era) and
// is a LIVE address again. The redirect rule that swallowed it had to be
// deleted from next.config.ts in the same change: config redirects run before
// filesystem routes, which is exactly how `/settings` became unreachable for a
// day in MESITA-1839. `legacy-redirects.test.ts` walks every live address
// through that table.
import { resolveOrgPage } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolveOrgPage("organization", await searchParams);
}
