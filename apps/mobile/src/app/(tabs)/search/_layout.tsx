import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";

export default function SearchLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Search" }} />
    </Stack>
  );
}
