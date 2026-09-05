// Organization — the legal person. Identity, team size, and what it holds.
//
// State is Not connected / Connected: an organization's own status is
// about money, not about places. Listed and Verified describe one address
// and live on the place, never here.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow, OrgStateBadge } from "@/components/console/badges";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { errMsg } from "@/lib/utils";
import { PageErrorState } from "@/components/business/PageErrorState";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  let error: string | null = null;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    error = errMsg(e, "Couldn't load your organizations.");
  }
  if (error) {
    return (
      <PageErrorState
        heading="Couldn't load your organizations"
        message={error}
        retryHref="/"
      />
    );
  }

  const org = resolveActiveOrg(orgs, sp.org);

  if (!org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Create your organization
        </h1>
        <p className="text-muted-foreground -mt-2 text-sm">
          One legal person, one RFC. It holds the places you claim, and the
          account that gets paid.
        </p>
        <Section title="New organization">
          <CreateOrganizationForm />
        </Section>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        {/* No payment account exists yet for any organization, so this is
            Not connected until the merchant migration lands. */}
        <OrgStateBadge state="not_connected" />
      </div>

      <Section
        title="Identity"
        description="One legal person, one RFC, one account."
      >
        <div>
          <DataRow label="Legal name">{org.legalName ?? "Not set"}</DataRow>
          <DataRow label="RFC">{org.rfc ?? "Not set"}</DataRow>
          <DataRow label="Currency">{org.currency}</DataRow>
          <DataRow label="Your role">
            <span className="capitalize">{org.myRole}</span>
          </DataRow>
        </div>
      </Section>

      <Section
        title="Places"
        description="What this organization holds."
        right={
          <Link
            href={withOrg(SHELL_ROUTES.places, org.id)}
            className="text-muted-foreground hover:text-foreground text-[12px]"
          >
            Manage
          </Link>
        }
      >
        <div>
          <DataRow label="Held">{org.placeCount}</DataRow>
        </div>
      </Section>

      <Section title="Add another organization">
        <CreateOrganizationForm />
      </Section>
    </>
  );
}
