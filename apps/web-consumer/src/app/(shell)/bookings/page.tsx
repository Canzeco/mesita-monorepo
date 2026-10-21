import { BookingsPage } from "@/components/consumer/bookings/BookingsPage";

// /bookings — the bar's Bookings tab (MESITA-2518): the guest's
// reservations, upcoming then past. Was /me/reservations.
export const dynamic = "force-dynamic";

export default function Page() {
  return <BookingsPage />;
}
