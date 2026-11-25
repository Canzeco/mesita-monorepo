import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function Layout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="add" options={{ title: "Add a place" }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
