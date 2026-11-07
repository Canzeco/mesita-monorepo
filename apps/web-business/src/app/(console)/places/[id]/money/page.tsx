import { OperationsPage } from "@/components/place-manage/OperationsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

// Money (MESITA-3301 as Transactions; Pato, MESITA-3308: "call the
// Transactions page Money"): every money row at the place, the three money
// products of Main: a payment, a voucher bought, cashback given (MESITA-3272
// W3 fills it). The page stands before any place takes payments.
export default async function MoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
