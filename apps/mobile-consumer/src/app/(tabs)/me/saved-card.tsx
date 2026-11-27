import { useLocalSearchParams, useRouter } from "expo-router";

import { SavedCardScreen } from "@/features/settings/screens/saved-card-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <SavedCardScreen id={typeof id === "string" ? id : ""} onRemoved={() => router.back()} />;
}
