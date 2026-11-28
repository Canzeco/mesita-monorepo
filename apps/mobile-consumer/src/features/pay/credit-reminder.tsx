import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { colors, space } from "@/theme";

import { listCredits, type Credit } from "./api";

// "YOU HAVE CREDITS AT <PLACE>" (Pato, 2026-11-27, MESITA-5080; the web's
// MESITA-5068, worded by MESITA-5075: no amount, no wallet mark). Home names
// the place where the guest can spend the most credit; a tap opens that
// place. No credit, no row. Same read and key as the Pay tab.

/** The credit to remind about: the most spendable, first on a tie. */
export function reminderCredit(credits: Credit[] | undefined): Credit | null {
  const held = (credits ?? []).filter((c) => c.spendableCents > 0);
  if (held.length === 0) return null;
  return held.reduce((best, c) => (c.spendableCents > best.spendableCents ? c : best));
}

export function CreditReminder({ onOpen }: { onOpen: (placeId: string) => void }) {
  const signedIn = useSession().guestId !== null;
  const credits = useQuery({
    queryKey: ["pay-credits"],
    queryFn: ({ signal }) => listCredits(signal),
    enabled: signedIn,
  });
  const c = reminderCredit(credits.data);
  if (!signedIn || !c) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`You have credits at ${c.name}`}
      onPress={() => onOpen(c.placeId)}
      style={styles.row}
      testID="home-credit-reminder"
    >
      <View style={styles.text}>
        <Text role="small" numberOfLines={1}>
          You have credits at <Text role="small" style={styles.name}>{c.name}</Text>
        </Text>
      </View>
      <Icon name="chevron-right" color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, minWidth: 0 },
  name: { fontWeight: "600" },
});
