import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";
import { ME_PAGES, useGate } from "@/features/auth";

const TITLE: Record<string, string> = {
  profile: "Profile",
  class: "Class",
  reservations: "Reservations",
  notifications: "Notifications",
  tickets: "Tickets",
  visit: "Visit",
  gift: "Gift",
  credit: "Credit",
  card: "Payment methods",
  "saved-card": "Card",
  plan: "Plan",
  share: "Share Mesita",
  settings: "Settings",
  contact: "Contact",
  feedback: "Send feedback",
  refunds: "Refunds",
  integrations: "Integrations",
  calendar: "Calendar",
  "vip-code": "Upgrade manually",
  "vip-instagram": "Upgrade with Instagram",
  "vip-agency": "Bring your people",
  delete: "Delete account",
};

/** Every Me page but index is a member's. */
export default function MeLayout() {
  const { member } = useGate();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Me", headerShown: member, statusBarStyle: member ? "dark" : "light" }} />
      <Stack.Protected guard={member}>
        {ME_PAGES.map((name) => (
          <Stack.Screen key={name} name={name} options={{ title: TITLE[name] ?? name }} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
