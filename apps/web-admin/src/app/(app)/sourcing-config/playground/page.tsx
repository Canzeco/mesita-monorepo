import { redirect } from "next/navigation";

// The Playground was retired 2026-08-01 — its eligibility tester was a
// duplicate of the policy already visible in the config table. Kept as a
// redirect so old links/bookmarks keep working.
export default function LegacySourcingPlaygroundRedirect() {
  redirect("/sourcing-config");
}
