// Organization — the legal person. Identity, team size, and what it holds.
//
// State is Not connected / Connected: an organization's own state is
// about money, not about places. Listed and Verified describe one address
// and live on the place, never here.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow, OrgStateBadge } from "@/components/console/badges";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { OrgLegalForm } from "@/components/console/OrgLegalForm";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetPaymentAccount,
  apiListOrganizations,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { PaymentsCard } from "@/components/console/PaymentsCard";
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
          It holds the places you claim, and the account that gets paid. Just
          the name to start — legal details wait until a place goes partner.
        </p>
        <Section title="New organization">
          <CreateOrganizationForm />
        </Section>
      </>
    );
  }

  // The merchant of record is the organization (MESITA-1545). Refresh-through
  // read: while the webhook endpoint is missing (MESITA-1531), this load IS
  // the moment the mirror syncs with Stripe. A failure degrades to "none" and
  // the card's own actions report their errors.
  let account: PaymentAccount | null = null;
  let orphaned = false;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    console.error("[organization] business-web-get-payment-account:", e);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        <OrgStateBadge
          state={account?.charges_enabled ? "connected" : "not_connected"}
        />
      </div>

      <Section
        title="Identity"
        description="One legal person, one RFC — needed only to partner places and get paid."
      >
        <div className="flex flex-col gap-4">
          {org.myRole === "owner" ? (
            <OrgLegalForm
              orgId={org.id}
              legalName={org.legalName}
              rfc={org.rfc}
            />
          ) : (
            <div>
              <DataRow label="Legal name">{org.legalName ?? "Not set"}</DataRow>
              <DataRow label="RFC">{org.rfc ?? "Not set"}</DataRow>
            </div>
          )}
          <div>
            <DataRow label="Currency">{org.currency}</DataRow>
            <DataRow label="Your role">
              <span className="capitalize">{org.myRole}</span>
            </DataRow>
          </div>
        </div>
      </Section>

      <Section
        title="Payments"
        description="The Stripe account this organization gets paid through."
      >
        <PaymentsCard
          orgId={org.id}
          account={account}
          orphaned={orphaned}
          isOwner={org.myRole === "owner"}
        />
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
