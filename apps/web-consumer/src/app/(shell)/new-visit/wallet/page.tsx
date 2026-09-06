import { CreditsClient } from "./CreditsClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /new-visit/wallet — Pay's second section (MESITA-1381). PARKED: it runs
// on a browser emulator, not a backend. No table, no Edge Function, and no
// venue-side surface behind it (MESITA-1380).
//
// Its third address and its second time at this one: /credits, /inbox/credits,
// here (2026-09-01), /wallet as a tab (09-05), back here (09-06). All three of
// the others 308 to this path.
//
// The seed is chosen SERVER-side and handed down as a prop, the same shape /me
// uses for ?settings and ?cards. A client useSearchParams() read here would
// need its own <Suspense> boundary or it de-opts the route and fails the build.
//
//   (default)     three balances, one of them mid-lock
//   ?demo=empty   the zero state
//
// Both only bite on a first visit or after Reset — the emulator's own state
// wins once it exists.
//
// No `export const dynamic` here: new-visit/layout.tsx forces the whole Pay
// segment dynamic, and a second declaration is one more thing to keep in step.
// That layout is the RIGHT place for it — a `dynamic` on new-visit/page.tsx
// covers that page only, never this child.

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <CreditsClient seed={parseCreditsDemo(sp)} />;
}
