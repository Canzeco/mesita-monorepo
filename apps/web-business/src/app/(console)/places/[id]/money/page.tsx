import { OperationsPage } from "@/components/place-manage/OperationsPage";
import { getPlaceMoney } from "@/lib/business-api";
import { MoneyPanel } from "./MoneyPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

// Money (MESITA-3301 as Transactions; Pato, MESITA-3308: "call the
// Transactions page Money"): every money row at the place, the three money
// products of Main: a payment, a voucher bought, cashback given (MESITA-3272
// W3 fills it). The page stands before any place takes payments.
// MESITA-3596: the owner's Money box and Log live here, not on Payments
// (Payments only configures). Anyone the server refuses the money read (an
// editor) keeps the empty frame.
export default async function MoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const money = await getPlaceMoney(id);
  if (money.ok) return <MoneyPanel placeId={id} initial={money.data} />;
  return (
    <OperationsPage
      placeId={id}
      chartLine="Every payment, voucher and cashback."
      rows={[
        { name: "Payments", line: "Guests who paid here by card or credit." },
        { name: "Vouchers", line: "Vouchers guests bought here." },
        { name: "Cashback", line: "Credit guests earned here." },
      ]}
      logLine="Every movement, newest first."
      empty="Nothing yet. It starts when a guest pays here with Mesita."
    />
  );
}
