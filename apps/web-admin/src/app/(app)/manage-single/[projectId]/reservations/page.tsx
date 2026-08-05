import { redirect } from "next/navigation";

// MESITA-900 — dedicated Reservations tab retired; bookings live on Performance.
export default async function UnitReservationsRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/performance`);
}
