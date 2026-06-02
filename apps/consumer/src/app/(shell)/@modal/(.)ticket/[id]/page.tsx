import { redirect } from "next/navigation";
import { payTicketPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

export default async function TicketModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(payTicketPath(id));
}
