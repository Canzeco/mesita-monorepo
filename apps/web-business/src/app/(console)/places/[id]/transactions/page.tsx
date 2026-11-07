import { OperationsPage } from "@/components/place-manage/OperationsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions" };

// Transactions (MESITA-3301): every money row at the place, the three money
// products of Main: a payment, a voucher bought, cashback given (MESITA-3272
// W3 fills it). The page stands before any place takes payments.
export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OperationsPage
      placeId={id}
      chartLine="Every transaction."
      rows={[
        { name: "Payments", line: "Guests who paid here by card or credit." },
        { name: "Vouchers", line: "Vouchers guests bought here." },
        { name: "Cashback", line: "Credit guests earned here." },
      ]}
      logLine="Each transaction, newest first."
      empty="No transactions yet. They start when a guest pays here with Mesita."
    />
  );
}
