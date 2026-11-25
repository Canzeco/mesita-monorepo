import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function HomeLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
