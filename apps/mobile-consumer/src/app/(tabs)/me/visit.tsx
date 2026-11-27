import { useLocalSearchParams } from "expo-router";

import { VisitScreen } from "@/features/settings/screens/visit-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VisitScreen id={typeof id === "string" ? id : ""} />;
}
