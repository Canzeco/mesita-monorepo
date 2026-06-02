import { redirect } from "next/navigation";
import { ticketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function TicketDetailsModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(ticketPath(id));
}

