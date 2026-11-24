import { BillScreen } from "./BillScreen";

// /bill/<id>?place=<place> — the waiter's bill (MESITA-4823).
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ place?: string }> }) {
  const [{ id }, { place }] = await Promise.all([params, searchParams]);
  return <BillScreen key={id} billId={id} placeId={typeof place === "string" ? place : ""} />;
}
