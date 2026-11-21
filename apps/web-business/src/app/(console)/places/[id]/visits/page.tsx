import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-4538): every bill, one list, each linked to the payments that paid it.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="visits" page="visits" searchParams={searchParams} />;
}
