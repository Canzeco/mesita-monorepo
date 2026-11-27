import { useState } from "react";
import { useRouter } from "expo-router";

import type { ReservationHalf } from "@/features/reservations/screens/halves";
import { ReservationsScreen } from "@/features/reservations/screens/list-screen";

export default function Route() {
  const router = useRouter();
  const [half, setHalf] = useState<ReservationHalf>("upcoming");
  return <ReservationsScreen half={half} onHalf={setHalf} onFind={() => router.push("/")} onOpen={(id) => router.push({ pathname: "/reservations/[id]", params: { id } })} />;
}
