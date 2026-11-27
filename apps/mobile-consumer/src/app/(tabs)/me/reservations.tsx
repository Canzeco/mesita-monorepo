import { useState } from "react";
import { useRouter } from "expo-router";

import { ReservationsScreen } from "@/features/reservations/screens/list-screen";
import type { ReservationHalf } from "@/features/reservations/screens/halves";

export default function Route() {
  const router = useRouter();
  const [half, setHalf] = useState<ReservationHalf>("upcoming");
  return <ReservationsScreen half={half} onHalf={setHalf} onOpen={(id) => router.push({ pathname: "/reservations/[id]", params: { id } })} />;
}
