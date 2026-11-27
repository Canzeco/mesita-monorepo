import { useLocalSearchParams } from "expo-router";

import { ReceiptScreen } from "@/features/pay/screens/receipt-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReceiptScreen id={typeof id === "string" ? id : ""} />;
}
