import { redirect } from "next/navigation";
import { TicketsPage } from "@/components/consumer/activity/MeLists";
import { isTicketKind, ticketsHref } from "@/lib/ticket-kinds";

// /me/tickets/<kind> — one kind of ticket (MESITA-3855). Anything else lands
// on All.
export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isTicketKind(kind)) redirect(ticketsHref());
  return <TicketsPage />;
}
