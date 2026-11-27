import { useRouter } from "expo-router";

import { ReservationsScreen } from "@/features/reservations/screens/list-screen";

export default function Route() {
  const router = useRouter();
  return <ReservationsScreen onOpen={(id) => router.push({ pathname: "/reservations/[id]", params: { id } })} />;
}
