import { useLocalSearchParams } from "expo-router";

import { OffersScreen } from "@/features/place/screens/offers-screen";

export default function Route() {
  const { id, key } = useLocalSearchParams<{ id: string; key?: string }>();
  return <OffersScreen id={typeof id === "string" ? id : ""} offerKey={typeof key === "string" ? key : ""} />;
}
