import { BillScreen } from "./BillScreen";

// /bill/<id> — the waiter's bill (MESITA-4823).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillScreen key={id} billId={id} />;
}
