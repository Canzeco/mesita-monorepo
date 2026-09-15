// Configuration — the organization's own setup, in FIVE BOXES (MESITA-1852).
//
// Pato, 2026-09-14, on the Settings page this replaces: *"Remove places from
// here, its redundant. five boxes: brand · members · stripe · partnership ·
// developers. change name of settings to configuration."*
//
// PLACES LEFT. It has a rail row one line above this page, and a box listing
// them again was the second door to one room — the thing this whole pass has
// been deleting.
//
// SETTINGS IS CONFIGURATION, label AND segment. "Settings" is a word this
// repo has burned twice (MESITA-1815 renamed a place view to it, MESITA-1841
// reversed that), and the flat `/settings` is still owned by a permanent
// legacy redirect onto `/capabilities` — which is why this page had no flat
// twin. `configuration` is unclaimed, so it has one again.
//
// STRIPE AND PARTNERSHIP MOVED HERE from Payments. Both are things you set
// up once: a Stripe account is connected and then forgotten, Partner is one
// switch. Payments is where you will read what happened, which is why it is
// parked as Soon until there is something to read.
//
// THE BOX IS NAMED "STRIPE", not "Payouts" (which implies a payouts report
// that does not exist) and not "Getting paid" (a sentence where a name goes).
// Its button already says Connect Stripe; naming the box after the thing you
// connect is the one label nobody has to decode.
//
// TWO BOXES ARE HONEST ABOUT BEING UNBUILT. Brand wants a logo and the
// loyalty card's colour; `Organization` carries neither column. Developers
// wants API keys. Both show Soon on the PAGE rather than a dimmed row in the
// rail (MESITA-1833, MESITA-1845).
import { notFound, redirect } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { Section } from "@/components/shared/Section";
import {
  apiGetPaymentAccount,
  apiListOrgMembers,
  apiListOrganizations,
  type OrgMember,
  type PaymentAccount,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

export default async function ConfigurationPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const supabase = await createServerSupabase();
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId))}`);
  }
  const org = findOrg(organizations, orgId);
  if (!org) notFound();

  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[configuration] business-web-list-org-members:", e);
  }

  // The Stripe box's own read. A failure is no box state, never a box that
  // asserts "not connected" about an account nobody managed to ask about.
  let account: PaymentAccount | null = null;
  let orphaned = false;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    console.error("[configuration] business-web-get-payment-account:", e);
  }

  const isOwner = org.myRole === "owner";
  const stripeReady =
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {org.name}
      </h1>
      <p className="text-muted-foreground text-sm leading-snug">
        You are {ROLE_LABEL[org.myRole]} here.
      </p>

      <SoonStrip {...SOON_STRIPS.brand} />

      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user.id}
        isOwner={isOwner}
        loadError={membersError}
      />

      <Section title="Stripe" description="The account this organization gets paid through.">
        <PaymentsCard
          orgId={org.id}
          account={account}
          orphaned={orphaned}
          isOwner={isOwner}
        />
      </Section>

      <Section
        title="Partnership"
        description="Free. Unlocks Mesita Pay, Visit Rewards and Accept Prepays at every held place."
      >
        <PartnerCard
          key={`${org.id}-${org.partnered === true ? "on" : "off"}`}
          orgId={org.id}
          partnered={org.partnered === true}
          stripeReady={stripeReady}
          isOwner={isOwner}
        />
      </Section>

      <SoonStrip {...SOON_STRIPS.developers} />
    </>
  );
}
