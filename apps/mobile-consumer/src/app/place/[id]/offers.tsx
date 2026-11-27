import { useLocalSearchParams } from "expo-router";

import { OffersScreen } from "@/features/place/screens/offers-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OffersScreen id={typeof id === "string" ? id : ""} />;
}
