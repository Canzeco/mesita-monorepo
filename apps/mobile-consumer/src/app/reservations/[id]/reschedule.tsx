import { useLocalSearchParams, useRouter } from "expo-router";

import { RescheduleScreen } from "@/features/reservations/screens/reschedule-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <RescheduleScreen id={typeof id === "string" ? id : ""} onDone={() => router.back()} />;
}
