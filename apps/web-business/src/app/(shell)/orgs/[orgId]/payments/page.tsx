// Payments — the Stripe Account and the Partner switch (MESITA-1807: their
// own route, off the one-scroll Organization screen). This is where Stripe
// sends the owner back: the Account Link's return_url is minted against
// this address, and `/` and Overview forward older links here.
import { PaymentsSections } from "@/components/console/PaymentsSections";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetPaymentAccount,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { requireOrg } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

export default async function OrganizationPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabase();
  const org = await requireOrg(supabase, orgId);

  // The account read is the Stripe sync moment while the webhook endpoint is
  // missing (MESITA-1531); its failure renders "none" and the card's actions
  // report their own errors.
  let account: PaymentAccount | null = null;
  let orphaned = false;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    console.error("[orgs/payments] business-web-get-payment-account:", e);
  }

  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Payments
      </h1>
      <PaymentsSections
        org={org}
        account={account}
        orphaned={orphaned}
        connect={connect}
      />
    </>
  );
}
