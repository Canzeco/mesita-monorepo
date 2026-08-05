import { redirect } from "next/navigation";
import { reservationPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy — detail used to live at /saved/reservation/[id].
export default async function LegacySavedReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(reservationPath(id));
}
