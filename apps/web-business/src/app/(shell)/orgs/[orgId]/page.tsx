// Overview — the organization's own page (MESITA-1807).
//
// The name paints first; where things stand streams in beneath it, because
// the connect state costs a payment-account read (p50 around a second) and
// the title should not wait for it. The Soon strips need nothing.
//
// `?connect=` is not this page's to answer: Stripe return links minted
// before MESITA-1807 still point here (and at `/`), and the notice lives on
// Payments — so a `?connect=` arrival is forwarded there with its query, and
// only after the organization resolved, so a member removed from their org
// cannot loop between two redirects.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OrgSoon, OrgStanding } from "@/components/console/OrgOverview";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetPaymentAccount,
  apiListOrgMembers,
  type Organization,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { orgHref, withQuery } from "@/lib/console-routes";
import { requireOrg } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

async function Standing({ org }: { org: Organization }) {
  const supabase = await createServerSupabase();
  // Two independent reads, two independent degrades. The account read is the
  // Stripe sync moment while the webhook endpoint is missing (MESITA-1531);
  // its failure renders Not connected. The members read NEVER degrades to a
  // count of zero — zero members is impossible (the creator is owner), so a
  // zero would be a lie; the row says it could not read them.
  const [accountRes, membersRes] = await Promise.allSettled([
    apiGetPaymentAccount(supabase, org.id),
    apiListOrgMembers(supabase, org.id),
  ]);
  let account: PaymentAccount | null = null;
  if (accountRes.status === "fulfilled") {
    account = accountRes.value.account;
  } else {
    console.error(
      "[orgs/overview] business-web-get-payment-account:",
      accountRes.reason,
    );
  }
  let memberCount = 0;
  let pendingCount = 0;
  let membersError: string | null = null;
  if (membersRes.status === "fulfilled") {
    memberCount = membersRes.value.members.length;
    pendingCount = membersRes.value.pendingInvites.length;
  } else {
    membersError = "Couldn't load members.";
    console.error(
      "[orgs/overview] business-web-list-org-members:",
      membersRes.reason,
    );
  }
  return (
    <OrgStanding
      org={org}
      account={account}
      memberCount={memberCount}
      pendingCount={pendingCount}
      membersError={membersError}
    />
  );
}

function StandingSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-muted h-[196px] animate-pulse rounded-2xl motion-reduce:animate-none"
    />
  );
}

export default async function OrganizationOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabase();
  const org = await requireOrg(supabase, orgId);
  if (typeof sp.connect === "string") {
    redirect(withQuery(orgHref(org.id, "payments"), sp));
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {org.name}
      </h1>
      <Suspense fallback={<StandingSkeleton />}>
        <Standing org={org} />
      </Suspense>
      <OrgSoon />
    </>
  );
}
