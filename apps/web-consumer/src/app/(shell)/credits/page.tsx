import { CreditsClient } from "./CreditsClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /credits — per-place prepaid Credits balances. PARKED: mock data, no table,
// no Edge Function, and no venue-side surface behind it (MESITA-1380).
//
// The fixture is chosen SERVER-side and handed down as a prop, the same shape
// /me uses for ?settings and ?cards. A client useSearchParams() read here would
// need its own <Suspense> boundary or it de-opts the route and fails the build.
//
//   (default)     the stack — what the surface is for
//   ?demo=solo    one balance, mid-lock: the honest year-one case
//   ?demo=empty   the zero state
export const dynamic = "force-dynamic";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <CreditsClient variant={parseCreditsDemo(sp)} />;
}
