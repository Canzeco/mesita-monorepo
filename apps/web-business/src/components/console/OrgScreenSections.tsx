// The Payments page's boxes, in the ONE place their order lives
// (MESITA-1832: "org & place payments (a settings thing)").
//
// Until the six-page console these were the Organization page (MESITA-1810:
// "organization all in the same page"), with Members and Places beside
// them. Members moved to /settings and Places to /account; what is left is
// the organization's MONEY: funnel first (approved at the autoplan gate,
// 2026-09-06) — Stripe, then Partner, then Prepaid Credits as the one Soon
// strip (MESITA-1828 took Mesita Capital and Activity off).
//
// Sync and presentational on purpose: the server page assembles the props,
// this component owns the composition, and the order test pins THIS file.

import { Section } from "@/components/shared/Section";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { SoonStrip } from "@/components/console/SoonStrip";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";

/** The box order, exported so the pin test asserts the product decision. */
export const ORG_SCREEN_ORDER = ["stripe", "partner", "credits"] as const;

export const SOON_STRIPS: Record<"credits", { title: string; line: string }> = {
  credits: {
    title: "Prepaid Credits",
    line: "The organization's Credits balance, terms, and outstanding liability will live here.",
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
        title="Stripe Account"
        description="The account this organization gets paid through."
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
        description="One switch for this organization. Free. Unlocks Mesita Pay, Visit Rewards and Accept Prepays at every held place."
      >
        <PartnerCard
          key={`${org.id}-${org.partnered === true ? "on" : "off"}`}
          orgId={org.id}
          partnered={org.partnered === true}
          stripeReady={stripeReady}
          isOwner={isOwner}
        />
      </Section>

      <SoonStrip {...SOON_STRIPS.credits} />
    </>
  );
}
