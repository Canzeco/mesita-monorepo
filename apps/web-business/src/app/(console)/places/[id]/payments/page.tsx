import { getPlaceMoney, getPlacePayments } from "@/lib/business-api";
import { getManagePlace } from "@/lib/place-view";
import { Card } from "@/components/shell/Page";
import { PaymentsPanel } from "./PaymentsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

// The money guests pay a place (MESITA-3296, Pato: "connect the Stripe account
// with the Sandbox for the moment"): the place's Stripe account, then the
// switches: Payments Cashback, one, and Prepaid Vouchers, six. Rates, bonuses
// and prices are not here (MESITA-3272 keeps them open with owners), so
// nothing charges yet. What the place pays Mesita is Billing.
export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stripe?: string }>;
}) {
  const [{ id }, { stripe }] = await Promise.all([params, searchParams]);
  // The layout already read the place (request-cached): its name goes on the
  // table QR (MESITA-3382).
  const [payments, manage] = await Promise.all([getPlacePayments(id), getManagePlace(id)]);
  // The owner's money (MESITA-3307): owners and Mesita staff only, so an
  // editor's page never asks.
  const money = payments.ok && payments.data.can_edit ? await getPlaceMoney(id) : null;
  return (
    <div className="flex flex-col gap-4 pb-8">
      {payments.ok ? (
        <PaymentsPanel placeId={id} placeName={manage?.place.name ?? null} initial={payments.data} money={money?.ok ? money.data : null} back={stripe === "return" ? "return" : stripe === "refresh" ? "refresh" : null} />
      ) : (
        <Card>
          <p className="font-semibold">Payments didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{payments.error}</p>
        </Card>
      )}
    </div>
  );
}
