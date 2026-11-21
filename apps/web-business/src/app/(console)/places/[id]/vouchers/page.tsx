import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vouchers" };

// Vouchers (MESITA-4538): prepayments guests bought, each linked to the credit it added and its story.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="vouchers" page="vouchers" searchParams={searchParams} />;
}
