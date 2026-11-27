import { useRouter } from "expo-router";

import { IntegrationsScreen } from "@/features/settings/screens/integrations-screen";

export default function Route() {
  const router = useRouter();
  return <IntegrationsScreen onCalendar={() => router.push("/me/calendar")} />;
}
