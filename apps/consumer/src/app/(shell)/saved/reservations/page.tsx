import { CalendarCheck } from "lucide-react";
import { ComingSoonSurface } from "@/components/consumer/ComingSoonSurface";

// The Reservations surface (the Reservations bottom-tab lands here) is parked
// behind a "Soon" gate — booking a table from Mesita isn't live yet, so this
// renders a single premium coming-soon panel instead of the Upcoming/History
// sub-tabs. The parked ReservationCard / Calendar / WhatsApp building blocks
// and the /saved/reservation/[id] detail route stay in the tree, unused, for
// an easy un-park once the booking flow ships.

export const dynamic = "force-dynamic";

export default function ReservationsPage() {
  return (
    <ComingSoonSurface
      icon={<CalendarCheck className="h-7 w-7" strokeWidth={2} />}
      title="Reservations"
      body="Booking a table straight from Mesita is on the way. For now, save the places you love — we'll let you know the moment reservations go live."
    />
  );
}
