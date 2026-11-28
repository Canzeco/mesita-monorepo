import { useState } from "react";
import { Redirect, useRouter } from "expo-router";

import { useGate } from "@/features/auth";
import type { ReservationHalf } from "@/features/reservations/screens/halves";
import { ReservationsScreen } from "@/features/reservations/screens/list-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

/** The Bookings tab: the guest's reservations, Upcoming | Past. Members only; the tab is hidden signed out. */
export default function Route() {
  const router = useRouter();
  const { member } = useGate();
  const [half, setHalf] = useState<ReservationHalf>("upcoming");
  if (!member) return <Redirect href="/me" />;
  return (
    <ReservationsScreen
      half={half}
      onHalf={setHalf}
      onFind={() => router.navigate("/")}
      onCalendar={() => router.push("/me/calendar")}
      onOpen={(id) => router.push({ pathname: "/reservations/[id]", params: { id } })}
    />
  );
}
