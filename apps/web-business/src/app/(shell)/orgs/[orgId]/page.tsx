// The organization's page (MESITA-1807, one page again since MESITA-1810):
// the name and its state, then the boxes — Stripe Account, Partner, Members,
// Places, and the three future boxes as Soon strips. Stripe sends the owner
// back here: the Account Link's return_url is minted against this address,
// and `/` forwards the links minted against the older ones.
//
// State is Not connected / Connected: an organization's own state is about
// money, not about places. Listed and Verified describe one address and live
// on the place, never here.
import { redirect } from "next/navigation";
import { OrgStateBadge } from "@/components/console/badges";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { OrgScreenSections } from "@/components/console/OrgScreenSections";
import { ScopeSwitchers } from "@/components/console/ScopeSwitchers";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import {
  apiGetPaymentAccount,
  apiListOrgMembers,
  type OrgMember,
  type PaymentAccount,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { requireOrg } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this session, and cache() hands back that answer.
  const user = await getServerUser();
  if (!user) redirect("/signin");
  const org = await requireOrg(supabase, orgId);

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

      {/* "Organization. (change organization, change place)" — Pato,
          2026-09-13. The two switchers are THIS page's, not the rail's
          (MESITA-1822). */}
      <ScopeSwitchers />

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
    </>
  );
}
