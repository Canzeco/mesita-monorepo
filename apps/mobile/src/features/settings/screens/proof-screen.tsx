import { Host, Switch } from "@expo/ui";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

/**
 * Step 1b's proof, replaced screen by screen in 1c: the native tab bar around
 * it, a guarded link that must land on Sign in, one Expo UI control and one
 * symbol, on both platforms.
 */
export function ProofScreen({ name }: { name: string }) {
  const [on, setOn] = useState(true);
  return (
    <View style={styles.screen}>
      <SymbolView
        name={{ ios: "fork.knife", android: "restaurant" }}
        size={space.xxl}
        tintColor={colors.ink}
      />
      <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {name}
      </Text>
      <Host matchContents>
        <Switch value={on} onValueChange={setOn} />
      </Host>
      <Link href="/me/profile" style={styles.link}>
        Open my profile
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.lg,
    backgroundColor: colors.page,
  },
  title: { ...type.title, color: colors.ink },
  link: { ...type.body, color: colors.ink, padding: space.md },
});
