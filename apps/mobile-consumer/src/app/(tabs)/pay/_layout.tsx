import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function PayLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="code" options={{ title: "Pay" }} />
      <Stack.Screen name="receipt" options={{ title: "Receipt" }} />
    </Stack>
  );
}
