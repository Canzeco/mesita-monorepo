import { ReservationsPanel } from "./ReservationsPanel";

export const metadata = { title: "Reservations" };

// Reservations (MESITA-3600, Pato: "in capabilities add Reservations, only
// configure no or yes"): one switch, moved from Settings › Actions. Guests
// ask for a table on Mesita and the Reservationist calls the place's phone to
// book it (Pato: "Reservations are received via phone. There are no
// operations logs"), so there is no list or log here. The place comes from
// the place layout's PlaceContext, so a flip survives moving between tabs.
export default function ReservationsPage() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <ReservationsPanel />
    </div>
  );
}
