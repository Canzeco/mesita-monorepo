import { useLocalSearchParams } from "expo-router";

import { ContactScreen } from "@/features/place/screens/menu-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContactScreen id={typeof id === "string" ? id : ""} />;
}
