import { ScrollView, StyleSheet, View } from "react-native";

import { Window } from "@/components/window";
import { useSession } from "@/features/auth";
import { colors } from "@/theme";

import { FamilyChip } from "../components/family-chip";
import { chipsFor, isSpecial, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";

/** Every family, five across, under the special lists. */
export function CategoriesScreen({ onClose }: { onClose: () => void }) {
  const { chip, selectChip } = useActiveLocation();
  const chips = chipsFor(useSession().guestId !== null);
  const pick = (key: ChipKey) => {
    selectChip(key);
    onClose();
  };
  const draw = (c: Chip) => <FamilyChip key={c.key} chip={c} on={c.key === chip} wide onPress={() => pick(c.key)} />;
  return (
    <Window title="Categories" label="Categories" onClose={onClose}>
      <ScrollView>
        <View style={styles.specials}>{chips.filter((c) => isSpecial(c.key)).map(draw)}</View>
        <View style={styles.rule} />
        <View style={styles.grid}>{chips.filter((c) => !isSpecial(c.key)).map(draw)}</View>
      </ScrollView>
    </Window>
  );
}

const styles = StyleSheet.create({
  specials: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 6, paddingTop: 12 },
  rule: { height: 1, marginTop: 12, marginHorizontal: 20, backgroundColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 16 },
});
