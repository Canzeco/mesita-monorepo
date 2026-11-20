import { RescheduleRoute } from "@/components/consumer/reservation-actions";

export const dynamic = "force-dynamic";

// Move your table (MESITA-4113). Cancel stays a confirm on the reservation.
export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RescheduleRoute id={id} />;
}
