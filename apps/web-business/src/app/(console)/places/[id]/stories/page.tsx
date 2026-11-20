import { TicketDeskPage } from "@/components/place-manage/TicketDeskPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stories" };

// Stories (MESITA-4487): the story tickets, a posted one that nobody has
// looked at first, so verification has a place to land.
export default async function StoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDeskPage placeId={id} kind="stories" />;
}
