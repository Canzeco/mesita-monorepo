import { MeScreen } from "@/components/consumer/me/MeScreen";
import { ReservationsPage } from "@/components/consumer/saved/ReservationsPage";

// /me/reservations — Me › Reservations (MESITA-2565), in Me's frame.
// /reservations, /bookings and /saved/reservations forward here.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <MeScreen title="Reservations" flush>
      <ReservationsPage />
    </MeScreen>
  );
}
