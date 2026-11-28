import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, space } from "@/theme";

import { Text } from "./text";

/** Asks before a hearted place leaves Saved. Saving itself stays immediate. */
export function RemoveSaved({
  name,
  onConfirm,
  onCancel,
}: {
  name: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={name !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text role="heading">Remove from Saved?</Text>
          <Text role="small" tone="muted">{name ? `${name} will leave your Saved places.` : "This place will leave your Saved places."}</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
              <Text role="strong">Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.remove}>
              <Text role="strong" tone="onInk">Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: space.lg },
  card: { backgroundColor: colors.paper, borderRadius: radius["2xl"], padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  cancel: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  remove: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
});
