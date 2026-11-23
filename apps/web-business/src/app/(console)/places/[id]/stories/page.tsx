import { MonitorPage, type SearchParams } from "@/components/place-manage/MonitorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stories" };

// Stories (MESITA-4732): every Instagram Story tied to the place, newest
// first, Pending, Rejected or Credited with the reward (MESITA-4714).
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  return <MonitorPage placeId={id} kind="stories" page="stories" searchParams={searchParams} />;
}
