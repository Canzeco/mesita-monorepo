// Configuration — the organization's own setup, in FIVE BOXES (MESITA-1852,
// merged to four in MESITA-1866, split into the two tiers in MESITA-1867).
//
// Pato, 2026-09-14, on the Settings page this replaces: *"Remove places from
// here, its redundant. five boxes: brand · members · stripe · partnership ·
// developers. change name of settings to configuration."*
//
// PLACES LEFT (MESITA-1852). It has a rail row one line above this page, and
// a box listing them again was the second door to one room — the thing this
// whole pass has been deleting.
//
// SETTINGS IS CONFIGURATION, label AND segment. "Settings" is a word this
// repo has burned twice (MESITA-1815 renamed a place view to it, MESITA-1841
// reversed that), and the flat `/settings` is still owned by a permanent
// legacy redirect onto `/capabilities` — which is why this page had no flat
// twin. `configuration` is unclaimed, so it has one again.
//
// STRIPE AND PARTNERSHIP MOVED HERE from Payments. Both are things you set
// up once: a Stripe account is connected and then forgotten, a subscription
// is taken out once. Payments is where you will read what happened, which is
// why it is parked as Soon until there is something to read.
//
// THE LABEL LANE, AND THE ORDER (MESITA-1861). Pato, on the live page:
// *"make this more pretty."* A design review found the ugliness was
// mechanical, not taste — the boxes stranded their content at opposite edges
// of a ~1690px card, the two unbuilt boxes carried bigger type than the live
// ones, and the h1 and its caption were separated by the same gap as two
// unrelated cards. Section's `lane` prop fixes the first, SoonStrip's
// geometry the second, and the header wrapper below the third. NOTHING here
// caps a width; the console is still fluid (MESITA-1836). And the order is
// the dependency: the one thing to set up first, then who may touch it, then
// the honest Soons. `loading.tsx` carries the same order, or every load ends
// in a shift.
//
// STRIPE AND PARTNERSHIP WERE ONE BOX (MESITA-1866). Pato: merge them. They
// were one chain pretending to be two: Stripe Ready was the LOCK on the
// Partner switch, so the Partnership box's locked state existed to say "go do
// the thing in the box above". Account, seam, switch — the prerequisite read
// first, the point read last. That composition survives below, one tier
// down.
//
// ── TWO TIERS (MESITA-1867) ───────────────────────────────────────────────
//
// Pato, 2026-09-15: the Stripe onboarding *"añade muchísima fricción"* and
// shrinks the market, so it stops being the door to the partnership. Two
// boxes now, ranked by depth:
//
// **Mesita Partner** — the organization's yearly subscription; every place it
// holds is in, and each place then turns on Visit Rewards, Accept Prepays
// and guest checks itself. Needs nothing but the subscription: no Stripe.
// The box is a price, a door (owner-only, modal, no checkout yet) and the
// price list. `PartnerCard.tsx`.
//
// **Mesita Pay** — the optional add-on: card payments inside Mesita through
// the organization's own Stripe account. Until the organization is a
// partner it is a flat `LockedStrip` — SoonStrip's geometry with a lock, one
// line saying what it needs — so the page has exactly one live box to act on.
// Partnered, it lifts to a Section holding what MESITA-1866 built: the
// account (`PaymentsCard`), a seam, and the switch (`MesitaPayCard`, the
// control that used to be the Partner switch, `aria-disabled` until
// MESITA-1868 gives `mesita_pay_enabled` a writer of its own).
//
// The page reads today's columns — `org.partnered`, `org.mesitaPayEnabled`,
// the Connect mirror — and neither door writes yet. Frontend first, by
// Pato's instruction; the backend decoupling is the next issue.
//
// TWO BOXES ARE HONEST ABOUT BEING UNBUILT. Brand wants a logo and the
// loyalty card's colour; `Organization` carries neither column. Developers
// wants API keys. Both show Soon on the PAGE rather than a dimmed row in the
// rail (MESITA-1833, MESITA-1845).
import { notFound, redirect } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import { MesitaPayCard } from "@/components/console/MesitaPayCard";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { LockedStrip, SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { Section } from "@/components/shared/Section";
import {
  apiGetPaymentAccount,
  apiListOrgMembers,
  apiListOrganizations,
  paymentAccountState,
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
  //
  // That was the INTENT, and for months the code did the opposite: the catch
  // left `account` null, `paymentAccountState(null, false)` returns "none",
  // and the card rendered the pill "No account" over a **Connect Stripe**
  // button — offering an owner with a live, charging account a second one,
  // because a blip and a genuine absence were the same value (MESITA-1861).
  // The flag is what tells them apart, and it is the same shape as the
  // members read directly above.
  //
  // Read whether or not the organization is a partner: the strip below needs
  // nothing from it, but a page that skipped the read for a non-partner
  // would paint a different box the moment the subscription flips. One
  // read, one shape, every state. (`?connect=` is Payments' concern — the
  // bare `/orgs/<id>` forwarder sends it there, never here.)
  let account: PaymentAccount | null = null;
  let orphaned = false;
  let accountError: string | null = null;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    accountError = "Couldn't load the Stripe account.";
    console.error("[configuration] business-web-get-payment-account:", e);
  }

  const isOwner = org.myRole === "owner";
  const partnered = org.partnered === true;
  // A failed read is NOT "not ready" — it is unknown. Mesita Pay stays
  // locked either way (the lock is the safe default), but the reason it gives
  // must not be a claim about an account nobody managed to fetch.
  const stripeReady =
    accountError === null &&
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;

  return (
    <>
      {/* The caption BELONGS to the title. The shell column is `gap-4` and
          this page is a fragment, so an unwrapped `h1` + `p` were 16px apart
          — the identical gap the column puts between two unrelated cards, and
          the caption read as floating between the name and the boxes. One
          wrapper, `gap-1`, and proximity says what it should (MESITA-1861). */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        <p className="text-muted-foreground text-sm leading-snug">
          You are {ROLE_LABEL[org.myRole]} here.
        </p>
      </div>

      <Section
        lane
        title="Mesita Partner"
        description="The organization's yearly partnership. Every place it holds is in."
      >
        <PartnerCard partnered={partnered} isOwner={isOwner} />
      </Section>

      {partnered ? (
        <Section
          lane
          title="Mesita Pay"
          description="Card payments inside Mesita, through the organization's own Stripe account. Optional."
        >
          <PaymentsCard
            orgId={org.id}
            account={account}
            orphaned={orphaned}
            isOwner={isOwner}
            loadError={accountError}
          />
          {/* ONE SEAM, inside one box (MESITA-1866): the account above, the
              switch it unlocks below. Not a second box — the prerequisite and
              the thing it gates are one subject. */}
          <div className="border-border/60 border-t pt-3">
            <MesitaPayCard
              partnered
              stripeReady={stripeReady}
              mesitaPayEnabled={org.mesitaPayEnabled === true}
              isOwner={isOwner}
              accountState={paymentAccountState(account, orphaned)}
              orphaned={orphaned}
              loadError={accountError}
            />
          </div>
        </Section>
      ) : (
        // Rank by depth (SoonStrip.tsx): a tier the organization cannot reach
        // yet lies flat, so the page has one live box to act on and one line
        // saying what comes next.
        <LockedStrip
          title="Mesita Pay"
          // The reason, and only the reason: the strip's line is a single
          // truncating row, and a description in front of it would eat the
          // one clause that says why the box is locked. The description
          // belongs to the lifted Section above.
          line="Needs Mesita Partner first."
        />
      )}

      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user.id}
        isOwner={isOwner}
        loadError={membersError}
      />

      <SoonStrip {...SOON_STRIPS.brand} />
      <SoonStrip {...SOON_STRIPS.developers} />
    </>
  );
}
