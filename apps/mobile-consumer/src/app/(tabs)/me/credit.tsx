import { useLocalSearchParams } from "expo-router";

import { CreditScreen } from "@/features/settings/screens/credit-screen";

export default function Route() {
  const { place, line } = useLocalSearchParams<{ place?: string; line?: string }>();
  return <CreditScreen place={typeof place === "string" ? place : ""} line={typeof line === "string" ? line : ""} />;
}
