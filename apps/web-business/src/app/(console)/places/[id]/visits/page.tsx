import { TicketDeskPage } from "@/components/place-manage/TicketDeskPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visits" };

// Visits (MESITA-3301, filled by MESITA-4487): a visit ticket is a guest
// paying here with Mesita, or a waiter's bill still open.
export default async function VisitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDeskPage placeId={id} kind="visits" />;
}
