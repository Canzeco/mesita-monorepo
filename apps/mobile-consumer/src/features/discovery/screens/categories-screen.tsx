import { ScrollView, StyleSheet, View } from "react-native";

import { Window } from "@/components/window";
import { useSession } from "@/features/auth";
import { colors } from "@/theme";

import { FamilyChip } from "../components/family-chip";
import { chipsFor, isSpecial, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";

/** Every family, five across, under the special lists: Social on its own,
 *  an upright line, then the specials (the web's CategoriesModal). */
export function CategoriesScreen({ onClose }: { onClose: () => void }) {
  const { chip, selectChip } = useActiveLocation();
  const chips = chipsFor(useSession().guestId !== null, true);
  const pick = (key: ChipKey) => {
    selectChip(key);
    onClose();
  };
  const draw = (c: Chip) => (
    <FamilyChip key={c.key} chip={c} on={c.key === chip} wide={isSpecial(c.key) ? "special" : "grid"} onPress={() => pick(c.key)} />
  );
  return (
    <Window title="Categories" label="Categories" onClose={onClose}>
      <ScrollView>
        <View style={styles.specials}>
          {chips.filter((c) => c.key === "social").map(draw)}
          <View style={styles.upright} />
          {chips.filter((c) => isSpecial(c.key) && c.key !== "social").map(draw)}
        </View>
        <View style={styles.rule} />
        <View style={styles.grid}>{chips.filter((c) => !isSpecial(c.key)).map(draw)}</View>
      </ScrollView>
    </Window>
  );
}

const styles = StyleSheet.create({
  specials: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 6, paddingTop: 12 },
  upright: { width: 1, marginHorizontal: 6, marginVertical: 4, backgroundColor: colors.border },
  rule: { height: 1, marginTop: 12, marginHorizontal: 20, backgroundColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: 2, rowGap: 12, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 16 },
});
