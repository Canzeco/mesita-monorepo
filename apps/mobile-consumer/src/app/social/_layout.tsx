import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function Layout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="person" options={{ title: "Person" }} />
      <Stack.Screen name="report" options={{ title: "Report" }} />
    </Stack>
  );
}
