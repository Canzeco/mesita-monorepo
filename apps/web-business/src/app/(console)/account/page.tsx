import { getIdentityCached } from "@/lib/identity";
import { listBilling } from "@/lib/business-api";
import { PageHeader } from "@/components/shell/Page";
import { AccountCard } from "@/components/shell/AccountCard";
import { WhatYouPay } from "./WhatYouPay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

// The account (MESITA-3123): one person's Google sign-in. Places and accounts
// are the only layers; each place's team lives in that place's Settings.
// What you pay (MESITA-3130) is the account's: every Premier you pay, on any
// place. With `?boost=<session>` (Update card's Checkout return) the read
// first settles that card.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ boost?: string }> }) {
  const { boost } = await searchParams;
  const [identity, billing] = await Promise.all([getIdentityCached(), listBilling(boost ?? null)]);
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-8">
      <PageHeader title="Account" />
      <AccountCard email={identity.ok ? identity.data.email : null} />
      <WhatYouPay
        initial={billing.ok ? billing.data.subscriptions : null}
        loadError={billing.ok ? null : billing.error}
        outcome={billing.ok ? (billing.data.outcome ?? null) : null}
      />
    </div>
  );
}
