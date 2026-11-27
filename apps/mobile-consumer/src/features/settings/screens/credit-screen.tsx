import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, space } from "@/theme";

/** One voucher line. Paying with it opens the code. */
export function CreditScreen({ place, line }: { place: string; line: string }) {
  const router = useRouter();
  return (
    <View style={styles.page}>
      <Text role="title">{place || "A Mesita place"}</Text>
      <Text role="body">{line || "Available"}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/pay/code")}>
        <Text role="label">Pay here</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, padding: space.lg, gap: space.md },
});
