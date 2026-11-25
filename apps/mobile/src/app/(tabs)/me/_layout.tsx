import { Stack } from "expo-router";

import { ME_PAGES, useGate } from "@/features/auth";

/** Every Me page but index is a member's. */
export default function MeLayout() {
  const { member } = useGate();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Me" }} />
      <Stack.Protected guard={member} redirectTo="/sign-in">
        {ME_PAGES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
