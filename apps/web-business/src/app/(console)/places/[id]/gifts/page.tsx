import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gifts" };

// Gifts (MESITA-4555, Pato: "Gifts (this one is important)"): one row per gift link: who sent it, to whom, and its status.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="gifts" page="gifts" searchParams={searchParams} />;
}
