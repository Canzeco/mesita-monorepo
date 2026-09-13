// Create organization — the ceremony (MESITA-1793, at `/orgs/new` since
// MESITA-1807). The collection is never a form: typing a name on the
// organization page was the cheap feeling.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { preferredOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, orgHref } from "@/lib/console-routes";
import { RAIL_ORG_COOKIE, plausibleId } from "@/lib/sidebar-prefs";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const supabase = await createServerSupabase();
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/orgs/new");

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    console.error("[orgs/new] business-web-list-organizations:", e);
  }
  // Cancel goes back to the organization you came from — the remembered one,
  // else the first. With none there is nothing to go back to but yourself.
  const jar = await cookies();
  const current = preferredOrg(
    orgs,
    plausibleId(jar.get(RAIL_ORG_COOKIE)?.value),
  );
  const first = orgs.length === 0;
  const cancelHref = current ? orgHref(current.id) : SHELL_ROUTES.account;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Create organization
      </h1>
      <p className="text-muted-foreground -mt-2 text-sm">
        {first
          ? "It holds the places you claim, and the account that gets paid. Just the name to start — legal details wait until a place goes partner."
          : "A separate legal person, with its own places and its own payouts."}
      </p>
      <CreateOrganizationForm cancelHref={cancelHref} />
    </>
  );
}
