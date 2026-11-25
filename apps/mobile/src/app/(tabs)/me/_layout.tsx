import { Stack } from "expo-router";

// No session exists yet: 1c replaces this constant with the auth feature's member.
const member = false;

export default function MeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Me" }} />
      <Stack.Protected guard={member} redirectTo="/sign-in">
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
      </Stack.Protected>
    </Stack>
  );
}
