import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { useMyProfile } from "@/features/auth";
import { space } from "@/theme";

export function ClassScreen() {
  const vip = useMyProfile().data?.isVip === true;
  return (
    <View style={styles.page}>
      <Text role="title">{vip ? "VIP Class" : "Regular Class"}</Text>
      <Text role="body">{vip ? "You are a VIP." : "You are a regular guest."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: space.lg, gap: space.sm } });
