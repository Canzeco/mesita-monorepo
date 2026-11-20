import { TicketDeskPage } from "@/components/place-manage/TicketDeskPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gifts" };

// Gifts (MESITA-4487): credit one guest sent a friend, to spend here.
export default async function GiftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDeskPage placeId={id} kind="gifts" />;
}
