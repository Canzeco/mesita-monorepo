import { useLocalSearchParams } from "expo-router";

import { PlaceContact } from "@/features/place/screens/place-contact";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceContact id={typeof id === "string" ? id : ""} />;
}
