// The organization segment (MESITA-1807). ONE membership check for every
// page beneath `/orgs/<id>`: the id in the path names an organization the
// caller belongs to, or this answers 404 — the same 404 for a foreign id and
// for one that does not exist, so the path can never be used to learn which
// organizations there are.
//
// No chrome of its own. The rail and the header belong to the shell layout
// above, which reads the organization off the pathname; this layout only
// decides whether the pathname is allowed to name it.
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  params,
  children,
}: {
  params: Promise<{ orgId: string }>;
  children: React.ReactNode;
}) {
  const { orgId } = await params;
  await requireOrg(await createServerSupabase(), orgId);
  return <>{children}</>;
}
