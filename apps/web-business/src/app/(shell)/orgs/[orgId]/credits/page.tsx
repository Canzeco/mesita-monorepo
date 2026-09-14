// Credits — THE ORGANIZATION's prepaid balance, terms and liability.
//
// Its own room since MESITA-1841. It was the one `SoonStrip` at the foot of
// Payments; Pato's 2026-09-14 drawing gives it a rail row, and a row whose
// destination is a scroll position on another page is a row that lies about
// where it goes.
//
// THE ENGINE IS NOT BUILT, and this page says so rather than showing knobs.
// House law (SoonStrip): an unbuilt engine shows Soon, never a fake balance.
// The page still exists, because MESITA-1833's rule is that every rail row
// opens something real — "here is what will live here" is a real answer; a
// dimmed row that does nothing is not.
import { notFound, redirect } from "next/navigation";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/OrgScreenSections";
import { apiListOrganizations } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CreditsPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "credits"))}`);
  }
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // the organization's own name, which the page prints.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Credits</h1>
      <p className="text-muted-foreground text-sm leading-snug">
        Prepaid Credits are money guests hand {org.name} before they spend it.
        Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.credits} />
    </>
  );
}
