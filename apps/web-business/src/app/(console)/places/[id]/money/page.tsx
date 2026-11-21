import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

// Payments (MESITA-4538; the URL stays /money, Offers owns /payments): bills paid with Mesita, then payouts to the bank.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="payments" page="money" searchParams={searchParams} payouts />;
}
