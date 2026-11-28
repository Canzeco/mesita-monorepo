import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function BookingsLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Bookings" }} />
    </Stack>
  );
}
