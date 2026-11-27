import { useLocalSearchParams } from "expo-router";

import { GiftScreen } from "@/features/settings/screens/gift-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GiftScreen id={typeof id === "string" ? id : ""} />;
}
