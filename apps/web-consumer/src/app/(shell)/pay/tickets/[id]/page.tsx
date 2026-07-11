import { redirect } from "next/navigation";
import { rewardsTicketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy /pay/tickets/[id] (plural alias) → canonical /rewards/ticket/[id].
export default async function LegacyPayTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(rewardsTicketPath(id));
}
