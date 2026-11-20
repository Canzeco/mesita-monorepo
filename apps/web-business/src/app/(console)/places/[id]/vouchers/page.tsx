import { TicketDeskPage } from "@/components/place-manage/TicketDeskPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vouchers" };

// Vouchers (MESITA-4487): prepayments guests bought here.
export default async function VouchersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDeskPage placeId={id} kind="vouchers" />;
}
