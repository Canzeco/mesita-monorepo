// Create organization — the ceremony (MESITA-1793). The collection is
// never a form: typing a name on `/organization` was the cheap feeling.
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/organization/new");

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    console.error("[organization/new] business-web-list-organizations:", e);
  }
  const current = resolveActiveOrg(orgs, sp.org);
  const first = orgs.length === 0;
  const cancelHref = current
    ? withOrg(SHELL_ROUTES.organization, current.id)
    : SHELL_ROUTES.organization;

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
