import { ReservationsPage } from "@/components/consumer/activity/MeLists";

// /me/reservations/past — Reservations' Past half (MESITA-3888, Pato:
// "Reservation divide by Upcoming and Past, two subpages"). The same page,
// its Past chip picked; /me/reservations is Upcoming.
export default function Page() {
  return <ReservationsPage />;
}
