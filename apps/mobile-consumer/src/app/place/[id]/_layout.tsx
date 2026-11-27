import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function Layout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Place", headerShown: false }} />
      <Stack.Screen name="menu" options={{ title: "Menu" }} />
      <Stack.Screen name="contact" options={{ title: "Contact" }} />
      <Stack.Screen name="report" options={{ title: "Report" }} />
    </Stack>
  );
}
