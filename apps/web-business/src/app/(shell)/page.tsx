// Organization — the legal person. Identity, team size, and what it holds.
//
// State is Not connected / Connected: an organization's own state is
// about money, not about places. Listed and Verified describe one address
// and live on the place, never here.
//
// Read-mostly on purpose. Everything here is typed once and looked at
// often, so the default is four rows and a count — the forms live behind
// the affordance that opens them.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow, OrgStateBadge } from "@/components/console/badges";
import { AddOrganizationDisclosure } from "@/components/console/AddOrganizationDisclosure";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { OrgIdentityCard } from "@/components/console/OrgIdentityCard";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
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
          It holds the places you claim, and the account that gets paid. Just
          the name to start — legal details wait until a place goes partner.
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

      <OrgIdentityCard
        orgId={org.id}
        legalName={org.legalName}
        rfc={org.rfc}
        currency={org.currency}
        myRole={org.myRole}
      />

      <Section
        title="Places"
        description="What this organization holds."
        right={
          org.placeCount > 0 ? (
            <Link
              href={withOrg(SHELL_ROUTES.places, org.id)}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Manage
            </Link>
          ) : undefined
        }
      >
        {org.placeCount === 0 ? (
          // Zero is not a data point worth a row. It is a next step.
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              None yet. Every place starts in the public pool.
            </p>
            <Link
              href={withOrg(SHELL_ROUTES.pool, org.id)}
              className={PILL_BUTTON_CLASS}
            >
              Claim from the pool
            </Link>
          </div>
        ) : (
          <div>
            <DataRow label="Held">{org.placeCount}</DataRow>
          </div>
        )}
      </Section>

      <AddOrganizationDisclosure />
    </>
  );
}
