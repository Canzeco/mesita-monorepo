import { redirect } from "next/navigation";
import { reservationPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy intercept — soft-nav to /saved/reservation/[id] lands on the
// canonical /reservation/[id] hard route (which may then re-intercept).
export default async function LegacySavedReservationModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(reservationPath(id));
}
