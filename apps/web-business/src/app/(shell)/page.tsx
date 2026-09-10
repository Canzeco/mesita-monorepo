// The console root. It used to BE the Organization screen; that screen has its
// own address now (MESITA-1727), so this is a forwarding address and nothing
// else.
//
// TEMPORARY, NOT PERMANENT, and that is the whole point of doing it this way.
// `redirect()` answers 307, so nothing caches `/` as "always goes to
// /organization". A `permanent: true` entry in next.config.ts would answer 308,
// which browsers cache on disk with no expiry — and `/` is the one path the
// follow-up work needs back, to resolve a landing (no organizations -> create
// one; one place -> that place; several -> the portfolio). Burn it here and no
// deploy can un-burn it.
//
// THE QUERY STRING TRAVELS. Stripe stores an Account Link's return_url when the
// link is minted, so a link created minutes before this shipped still points at
// `/?org=<id>&connect=return`. Dropping the query would land the operator on an
// Organization screen that knows neither which organization they onboarded nor
// that they just came back from Stripe — the return notice reads `?connect=`
// and the org resolves from `?org=`. Forwarding the whole string costs nothing
// and covers every other param the same way.
import { redirect } from "next/navigation";
import { SHELL_ROUTES, withQuery } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function ConsoleRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  redirect(withQuery(SHELL_ROUTES.organization, sp));
}
