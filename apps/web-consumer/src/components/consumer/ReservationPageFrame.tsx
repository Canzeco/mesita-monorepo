import type { ReactNode } from "react";
import { Screen } from "@/components/consumer/nav/Screen";

// The hard-nav reservation's frame (/reservation/[id]): the one pushed-page
// frame (Screen, MESITA-3647), "Reservation" centred. Only a cold open lands
// here (inside the app a reservation opens as a panel), so Back lands on the
// route map's parent, Me › Reservations (MESITA-3646). The page and its
// loading.tsx (ReservationPageSkeleton) both draw THIS, so the header shown
// while it loads is the one that stays (Pato, MESITA-2701).
export function ReservationPageFrame({ children }: { children: ReactNode }) {
  return (
    <Screen title="Reservation" flush>
      {children}
    </Screen>
  );
}
