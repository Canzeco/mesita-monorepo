import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/** A task with steps, on the photo: the phone, then the code. */
export default function SignInLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
