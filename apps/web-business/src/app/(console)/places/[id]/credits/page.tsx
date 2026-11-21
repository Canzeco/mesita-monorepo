import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credits" };

// Credits (MESITA-4538): the credit ledger, read-only. Vouchers add credit, payments spend it, gifts move it between guests.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="credits" page="credits" searchParams={searchParams} />;
}
