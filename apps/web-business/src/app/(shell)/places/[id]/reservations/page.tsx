// Reservations — table bookings through the place's preferred provider. One
// row, and its own address, because the rail lists Reservations and a rail
// row has to name the room it opens (MESITA-1833, MESITA-1885).
//
// The gate is Capabilities' gate unchanged: a viewer may read the place,
// never configure it. `PlaceTabGate` enforces it from the matrix the layout
// already resolved (MESITA-1875).
import { ProductLadderTab } from "@/components/place-manage/ProductLadderTab";

export default function ReservationsPage() {
  return <ProductLadderTab zone="reservations" />;
}
