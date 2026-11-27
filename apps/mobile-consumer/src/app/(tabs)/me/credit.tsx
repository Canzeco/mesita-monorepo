import { useLocalSearchParams } from "expo-router";

import { CreditScreen } from "@/features/settings/screens/credit-screen";

export default function Route() {
  const { placeId, entry } = useLocalSearchParams<{ placeId?: string; entry?: string }>();
  return <CreditScreen placeId={typeof placeId === "string" ? placeId : ""} entryKey={typeof entry === "string" ? entry : ""} />;
}
