import { MeScreen } from "@/components/consumer/me/MeScreen";
import { ReservationsPageSkeleton } from "@/components/consumer/saved/ReservationsPage";

// /me/reservations' fallback: the page as it first paints — MeScreen's bar
// and title over ReservationsPage's own skeleton, the page's white pane
// around the card silhouettes ReservationsList draws while
// consumer-web-list-reservations is out (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). The pane and the list are the page's, so the route fallback
// hands over to it without a jump, and the cards land where their
// silhouettes stood.
export default function ReservationsLoading() {
  return (
    <MeScreen title="Reservations" flush>
      <ReservationsPageSkeleton />
    </MeScreen>
  );
}
