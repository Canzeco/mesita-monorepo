// The organization a route is scoped to, on the server (MESITA-1807).
//
// `orgs/[orgId]/layout.tsx` calls this once and every page beneath it calls
// it again; `cache()` makes the second call free within a request, and the
// organizations themselves come through the request-cached viewer read the
// shell layout already paid for. So a page under an organization costs no
// Edge Function round trip beyond its own body.
//
// A foreign id and a nonexistent id both `notFound()` — the same answer, so
// the path can never be used to learn which organizations exist.
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiListOrganizations, type Organization } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";

export const requireOrg = cache(async function requireOrg(
  client: SupabaseClient,
  orgId: string,
): Promise<Organization> {
  const org = findOrg(await apiListOrganizations(client), orgId);
  if (!org) notFound();
  return org;
});
