import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function Layout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Reservation" }} />
      <Stack.Screen name="reschedule" options={{ title: "Reschedule" }} />
    </Stack>
  );
}
