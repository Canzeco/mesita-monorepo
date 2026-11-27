import { useRouter } from "expo-router";

import { SettingsScreen } from "@/features/settings/screens/settings-screen";

export default function Route() {
  const router = useRouter();
  return <SettingsScreen onDelete={() => router.push("/me/delete")} />;
}
