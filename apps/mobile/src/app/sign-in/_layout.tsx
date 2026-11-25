import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";

import { headerOptions } from "@/components/header";
import { colors, space } from "@/theme";

/** A task with steps: the phone, then the code. ✕ closes all of it. */
export default function SignInLayout() {
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "Sign in",
          headerLeft: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={space.md} onPress={close}>
              <SymbolView name={{ ios: "xmark", android: "close" }} size={space.xl} tintColor={colors.ink} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="code" options={{ title: "Code" }} />
    </Stack>
  );
}
