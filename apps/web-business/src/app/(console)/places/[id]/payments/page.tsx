import { getPlacePayments } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { PaymentsPanel } from "./PaymentsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offers" };

// The money guests pay a place (MESITA-3296, Pato: "connect the Stripe account
// with the Sandbox for the moment"): the place's Stripe account, then the
// boxes Credits Account · Stripe Account · Visit Checkout · Prepaid Vouchers
// (Instagram Stories removed, MESITA-4766). What the place pays
// Mesita is Billing. Configuration
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
    // NOT THAT WIDE (Pato, 2026-11-23, MESITA-4756): one centred column.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-8">
      {payments.ok ? (
        <PaymentsPanel placeId={id} initial={payments.data} back={stripe === "return" ? "return" : stripe === "refresh" ? "refresh" : null} />
      ) : (
        <Card>
          <p className="font-semibold">Offers didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{payments.error}</p>
        </Card>
      )}
    </div>
  );
}
