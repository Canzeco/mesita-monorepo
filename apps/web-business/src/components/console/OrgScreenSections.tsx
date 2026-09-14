// The Payments page's boxes, in the ONE place their order lives
// (MESITA-1832: "org & place payments (a settings thing)").
//
// Until the six-page console these were the Organization page (MESITA-1810:
// "organization all in the same page"), with Members and Places beside
// them. Members moved to /settings and Places to /account; what is left is
// the organization's MONEY: funnel first (approved at the autoplan gate,
// 2026-09-06) — Stripe, then Partner.
//
// CREDITS LEFT IN MESITA-1841 AND CAME BACK IN MESITA-1845. It was this
// page's one `SoonStrip`; the 2026-09-14 drawing gave it a rail row, so it
// became a page — and when Pato's next list dropped that row he answered the
// question of where it goes with one word: *"merge."* The strip is back, word
// for word, and `/orgs/<id>/credits` forwards here.
//
// The rule that sent it away still holds and is simply not in play: a row
// whose destination is a scroll position two boxes down a different page is a
// row that lies about where it goes. Credits has no row to lie with now.
//
// Sync and presentational on purpose: the server page assembles the props,
// this component owns the composition, and the order test pins THIS file.

import { Section } from "@/components/shared/Section";
import { SoonStrip } from "@/components/console/SoonStrip";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";

/** The box order, exported so the pin test asserts the product decision. */
export const ORG_SCREEN_ORDER = ["stripe", "partner"] as const;

/** The future boxes, by the page that renders them. MESITA-1841 gave Credits
 *  a room and a rail row; MESITA-1845 merged it back into Payments on Pato's
 *  one word — *"merge"* — so the strip is at the foot of PaymentsSections
 *  again, exactly where it was and word for word unchanged. Customers is the
 *  new one: a live rail row whose page says what will live there, because a
 *  dimmed row is the thing MESITA-1833 forbids. */
export const SOON_STRIPS: Record<
  "credits" | "customers",
  { title: string; line: string }
> = {
  credits: {
    title: "Prepaid Credits",
    line: "The organization's Credits balance, terms, and outstanding liability will live here.",
  },
  customers: {
    title: "Customers",
    line: "The guests who visit and pay at this organization's places, and what they are worth.",
  },
};

export function PaymentsSections({
  org,
  account,
  orphaned,
}: {
  org: Organization;
  account: PaymentAccount | null;
  orphaned: boolean;
}) {
  const isOwner = org.myRole === "owner";
  const stripeReady =
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;
  return (
    <>
      <Section
        title="Stripe"
      >
        <PaymentsCard
          orgId={org.id}
          account={account}
          orphaned={orphaned}
          isOwner={isOwner}
        />
      </Section>

      <Section
        title="Partner"
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

      {/* PREPAID CREDITS, back at the foot of this page (MESITA-1845). It is
          the third thing the organization's money is: the account it gets
          paid through, the switch that unlocks the rungs, and the balance
          guests hand over before they spend it. */}
      <SoonStrip {...SOON_STRIPS.credits} />
    </>
  );
}
