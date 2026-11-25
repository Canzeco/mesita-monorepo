import { Stack } from "expo-router";

import { headerOptions } from "@/components/header";
import { ME_PAGES, useGate } from "@/features/auth";

/** Every Me page but index is a member's. */
export default function MeLayout() {
  const { member } = useGate();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: "Me", headerShown: member, statusBarStyle: member ? "dark" : "light" }} />
      <Stack.Protected guard={member}>
        {ME_PAGES.map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{ title: name === "delete" ? "Delete account" : name[0].toUpperCase() + name.slice(1) }}
          />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
