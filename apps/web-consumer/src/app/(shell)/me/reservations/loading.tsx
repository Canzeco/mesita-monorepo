import { MeScreen } from "@/components/consumer/me/MeScreen";
import { LoadingFill } from "@/components/shared";

// /me/reservations' fallback: the page as it first paints — MeScreen's bar
// and title, the white pane, and ReservationsList's own spinner while
// consumer-web-list-reservations is out (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). The pane is ReservationsPage's classes. The list draws a spinner,
// not card silhouettes, so this does too: card blocks here would collapse
// into that spinner and grow back into cards.
export default function ReservationsLoading() {
  return (
    <MeScreen title="Reservations" flush>
      <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <LoadingFill label="Loading reservations" />
      </div>
    </MeScreen>
  );
}
