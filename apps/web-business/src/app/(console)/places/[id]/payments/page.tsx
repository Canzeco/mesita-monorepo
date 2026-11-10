import { getPlacePayments } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { PaymentsPanel } from "./PaymentsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

// The money guests pay a place (MESITA-3296, Pato: "connect the Stripe account
// with the Sandbox for the moment"): the place's Stripe account, then the
// switches: a Cashback-as-Credits on each way to pay, and Prepaid Vouchers, six. Rates, bonuses
// and prices are not here (MESITA-3272 keeps them open with owners), so
// nothing charges yet. What the place pays Mesita is Billing. Configuration
// only (MESITA-3596): the owner's money and its log are Operations › Money.
export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stripe?: string }>;
}) {
  const [{ id }, { stripe }] = await Promise.all([params, searchParams]);
  const payments = await getPlacePayments(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {payments.ok ? (
        <PaymentsPanel placeId={id} initial={payments.data} back={stripe === "return" ? "return" : stripe === "refresh" ? "refresh" : null} />
      ) : (
        <Card>
          <p className="font-semibold">Payments didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{payments.error}</p>
        </Card>
      )}
    </div>
  );
}
