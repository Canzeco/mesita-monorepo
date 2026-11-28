import { useLocalSearchParams, useRouter } from "expo-router";

import { ReservationScreen } from "@/features/reservations/screens/reservation-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const reservationId = typeof id === "string" ? id : "";
  return (
    <ReservationScreen
      id={reservationId}
      onReschedule={() => router.push({ pathname: "/reservations/[id]/reschedule", params: { id: reservationId } })}
      onList={() => router.navigate("/bookings")}
    />
  );
}
