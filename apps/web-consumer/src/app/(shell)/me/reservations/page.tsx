import { ReservationsPage } from "@/components/consumer/activity/MeLists";

// /me/reservations — Upcoming; its Past chip is /me/reservations/past
// (MESITA-3888; one list, Upcoming then Past, under MESITA-3855; Activity's
// Reservations chip before that).
export default function Page() {
  return <ReservationsPage />;
}
