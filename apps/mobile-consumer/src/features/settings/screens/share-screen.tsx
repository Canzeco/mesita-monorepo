import { Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { space } from "@/theme";

export function ShareScreen() {
  return (
    <View style={styles.page}>
      <Text role="body">Tell a friend about Mesita.</Text>
      <Button label="Share" onPress={() => void Share.share({ message: "Mesita\nhttps://mesita.ai" })} />
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: space.lg, gap: space.md } });
