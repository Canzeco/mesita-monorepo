import { useRouter } from "expo-router";

import { SettingsScreen } from "@/features/settings/screens/settings-screen";

export default function Route() {
  const router = useRouter();
  return (
    <SettingsScreen
      nav={{
        onIntegrations: () => router.push("/me/integrations"),
        onRefunds: () => router.push("/me/refunds"),
        onContact: () => router.push("/me/contact"),
        onFeedback: () => router.push("/me/feedback"),
      }}
    />
  );
}
