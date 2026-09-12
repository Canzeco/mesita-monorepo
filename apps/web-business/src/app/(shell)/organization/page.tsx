// Organizations — the collection (MESITA-1793). Zero is an empty state
// with a Create button, never a form. One org is today's five boxes. Two
// or more is the list, then the selected org's boxes.
//
// State is Not connected / Connected: an organization's own state is about
// money, not about places. Listed and Verified describe one address and live
// on the place, never here.
import Link from "next/link";
import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrgStateBadge } from "@/components/console/badges";
import { OrgList } from "@/components/console/OrgList";
import { OrgScreenSections } from "@/components/console/OrgScreenSections";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
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
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";
import { PageErrorState } from "@/components/business/PageErrorState";

export const dynamic = "force-dynamic";

function CreateAnotherLink() {
  return (
    <Link
      href={SHELL_ROUTES.organizationNew}
      className="text-muted-foreground hover:text-foreground self-start text-[13px] underline underline-offset-4 transition"
    >
      Create another organization
    </Link>
  );
}

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this JWT over the network this request, and cache() hands back
  // that answer instead of asking again (MESITA-1729).
  const user = await getServerUser();
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
          Organizations
        </h1>
        <EmptyState
          icon={<Building2 className="text-muted-foreground h-5 w-5" />}
          title="No organizations yet"
          description="An organization holds the places you claim, and the account that gets paid."
          action={
            <Link
              href={SHELL_ROUTES.organizationNew}
              className={CTA_BUTTON_CLASS}
            >
              Create organization
            </Link>
          }
        />
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

  const connect = typeof sp.connect === "string" ? sp.connect : undefined;
  const many = orgs.length > 1;

  return (
    <>
      {many ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Organizations
          </h1>
          <OrgList organizations={orgs} activeId={org.id} />
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {org.name}
            </h2>
            <OrgStateBadge
              state={account?.charges_enabled ? "connected" : "not_connected"}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {org.name}
          </h1>
          <OrgStateBadge
            state={account?.charges_enabled ? "connected" : "not_connected"}
          />
        </div>
      )}

      {/* Above everything: the answer to "did that work?" comes before the
          screen it is about (MESITA-1645). */}
      <ConnectReturnNotice connect={connect} />
      <OrgScreenSections
        org={org}
        myManagerId={user.id}
        account={account}
        orphaned={orphaned}
        members={members}
        pendingInvites={pendingInvites}
        membersError={membersError}
      />
      <CreateAnotherLink />
    </>
  );
}
