// Organization — the legal person. Five boxes and a Places row, funnel-first:
// the Stripe account (state + CTA + legal identity), the members, what it
// holds, then the three money products as honest Soon strips. Composition
// and order live in OrgScreenSections; this file authenticates, fetches, and
// degrades.
//
// State is Not connected / Connected: an organization's own state is about
// money, not about places. Listed and Verified describe one address and live
// on the place, never here.
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { OrgStateBadge } from "@/components/console/badges";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { OrgScreenSections } from "@/components/console/OrgScreenSections";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetPaymentAccount,
  apiListOrganizations,
  apiListOrgMembers,
  type OrgMember,
  type PaymentAccount,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES } from "@/lib/console-routes";
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
        retryHref={SHELL_ROUTES.organization}
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

  // Two independent reads, two independent degrades. The account read is the
  // Stripe sync moment while the webhook endpoint is missing (MESITA-1531);
  // its failure renders "none" and the card's actions report their own
  // errors. The members read NEVER degrades to an empty list — zero members
  // is impossible (the creator is owner), so an empty render would be a lie.
  let account: PaymentAccount | null = null;
  let orphaned = false;
  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  const [accountRes, membersRes] = await Promise.allSettled([
    apiGetPaymentAccount(supabase, org.id),
    apiListOrgMembers(supabase, org.id),
  ]);
  if (accountRes.status === "fulfilled") {
    ({ account, orphaned } = accountRes.value);
  } else {
    console.error(
      "[organization] business-web-get-payment-account:",
      accountRes.reason,
    );
  }
  if (membersRes.status === "fulfilled") {
    ({ members, pendingInvites } = membersRes.value);
  } else {
    membersError = "Couldn't load members.";
    console.error(
      "[organization] business-web-list-org-members:",
      membersRes.reason,
    );
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

      {/* Above everything: the answer to "did that work?" comes before the
          screen it is about (MESITA-1645). */}
      <ConnectReturnNotice
        connect={typeof sp.connect === "string" ? sp.connect : undefined}
      />
      <OrgScreenSections
        org={org}
        myManagerId={user.id}
        account={account}
        orphaned={orphaned}
        members={members}
        pendingInvites={pendingInvites}
        membersError={membersError}
      />
    </>
  );
}
