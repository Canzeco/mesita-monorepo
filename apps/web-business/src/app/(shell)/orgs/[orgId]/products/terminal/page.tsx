// Mesita Terminal — the one product with no engine, no column and no switch.
//
// THE PAGE EXISTS BECAUSE THE ROW DOES (MESITA-1885). Pato put all eight
// products in the rail, and MESITA-1833 is his own law — *"make all this
// functional. not hidden shit."* — so the rail renders Terminal at full
// strength like every other row, and full strength has to open something real.
// "Here is what will live here" is a real answer; a dimmed row that does
// nothing is not. Customers' page is the same shape for the same reason.
//
// The Soon badge lives on this page, never in the rail, and there are no knobs
// on it: an unbuilt engine shows Soon, never a fake feed and never a fake
// number. The catalogue card has said exactly this — `soon`, no count, no verb
// — since MESITA-1869; this is the same sentence with an address.
import { notFound, redirect } from "next/navigation";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { apiListOrganizations } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgTerminalHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TerminalPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const user = await getServerUser();
  if (!user) {
    // BACK TO THIS PAGE, not to the catalogue above it: `next` is a promise
    // that signing in resumes what you opened, and every sibling page keeps
    // it. Sending a Terminal link to the grid would be a quiet redirect an
    // operator has to notice and undo.
    redirect(`/signin?next=${encodeURIComponent(orgTerminalHref(orgId))}`);
  }
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // the organization's own name, which the page prints.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Mesita Terminal
      </h1>
      <p className="text-muted-foreground text-sm leading-snug">
        Card payments taken in person at {org.name}&apos;s places, on Mesita
        hardware. Nothing is live yet.
      </p>
      <SoonStrip {...SOON_STRIPS.terminal} />
    </>
  );
}
