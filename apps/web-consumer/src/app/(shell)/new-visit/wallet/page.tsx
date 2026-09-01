import { CreditsClient } from "./CreditsClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /inbox/credits — the Inbox's first section (MESITA-1381). PARKED: it runs
// on a browser emulator, not a backend. No table, no Edge Function, and no
// venue-side surface behind it (MESITA-1380).
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
// No `export const dynamic` here: inbox/layout.tsx already forces the whole
// segment dynamic, and a second declaration is one more thing to keep in step.

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <CreditsClient seed={parseCreditsDemo(sp)} />;
}
