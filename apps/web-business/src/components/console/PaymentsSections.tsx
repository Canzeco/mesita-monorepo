// The Payments page's boxes, in the ONE place their order lives
// (MESITA-1807): the Stripe return notice first — the answer to "did that
// work?" comes before the screen it is about (MESITA-1645) — then the Stripe
// Account, then Partner. Partner rides with Stripe because Pato put it "next
// to Stripe Account" (MESITA-1798) and Stripe Ready is its lock.
//
// Sync and presentational on purpose: the page assembles the props, this
// file owns the composition, and the order test pins THIS file.

import { Section } from "@/components/shared/Section";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";

/** The box order, exported so the pin test asserts the product decision. */
export const PAYMENTS_ORDER = ["notice", "stripe", "partner"] as const;

export function PaymentsSections({
  org,
  account,
  orphaned,
  connect,
}: {
  org: Organization;
  account: PaymentAccount | null;
  orphaned: boolean;
  /** `?connect=return|refresh`, what Stripe sent the owner back with. */
  connect?: string;
}) {
  const isOwner = org.myRole === "owner";
  const stripeReady =
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;
  return (
    <>
      <ConnectReturnNotice connect={connect} />

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
    </>
  );
}
