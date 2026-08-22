import { redirect } from "next/navigation";

// MESITA-900 — dedicated Reservations tab retired; bookings live on Performance.
export default async function ReservationsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/place/${id}/performance`);
}
