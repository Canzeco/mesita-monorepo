// Customers — WHO KEEPS COMING BACK to this organization's places.
//
// Pato, 2026-09-14, on a screenshot of the MESITA-1844 rail: *"add customers
// maybe"*, listed as `Costumers (Soon)`.
//
// THE ENGINE IS NOT BUILT, and this page says so rather than showing knobs.
// House law (SoonStrip): an unbuilt engine shows Soon, never a fake feed.
//
// THE PAGE EXISTS BECAUSE THE ROW DOES. MESITA-1833 is Pato's own law — *"make
// all this functional. not hidden shit."* — so the rail renders Customers at
// full strength like every other row, and full strength has to open something
// real. "Here is what will live here" is a real answer; a dimmed row that does
// nothing is not, and with an empty catalogue a dimmed row is the first thing
// a new operator sees. The Soon badge lives on this page, never in the rail.
import { notFound, redirect } from "next/navigation";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/OrgScreenSections";
import { apiListOrganizations } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomersPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "customers"))}`);
  }
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // the organization's own name, which the page prints.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Customers</h1>
      <p className="text-muted-foreground text-sm leading-snug">
        The guests who visit and pay at {org.name}&apos;s places. Nothing is
        live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.customers} />
    </>
  );
}
