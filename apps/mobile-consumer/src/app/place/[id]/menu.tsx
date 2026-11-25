import { useLocalSearchParams } from "expo-router";

import { MenuScreen } from "@/features/place/screens/menu-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MenuScreen id={typeof id === "string" ? id : ""} />;
}
