import { ScrollView, StyleSheet, View } from "react-native";

import { Window } from "@/components/window";
import { useSession } from "@/features/auth";
import { colors } from "@/theme";

import { FamilyChip } from "../components/family-chip";
import { chipsFor, isSpecial, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";

/** Every family, five across, under the special lists: Social on its own,
 *  an upright line, then the specials (the web's CategoriesModal). */
export function CategoriesScreen({ onClose, home = true }: { onClose: () => void; home?: boolean }) {
  const { chip, selectChip } = useActiveLocation();
  // Saved is Home's (Search's window has Nearby and Popular only).
  const chips = chipsFor(useSession().guestId !== null && home, home);
  const lead = chips.filter((c) => c.key === "social");
  const saved = chips.filter((c) => c.key === "saved");
  const families = chips.filter((c) => !isSpecial(c.key));
  // Rows of five equal columns, 2 apart: the web's grid-cols-5 gap-x-0.5.
  const rows = Array.from({ length: Math.ceil(families.length / 5) }, (_, i) => families.slice(i * 5, i * 5 + 5));
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
          {/* Three groups, a line after each that is there (MESITA-5131):
              Social | Saved | Nearby Popular. */}
          {lead.map(draw)}
          {lead.length > 0 ? <View style={styles.upright} /> : null}
          {saved.map(draw)}
          {saved.length > 0 ? <View style={styles.upright} /> : null}
          {chips.filter((c) => isSpecial(c.key) && c.key !== "social" && c.key !== "saved").map(draw)}
        </View>
        <View style={styles.rule} />
        <View style={styles.grid}>
          {rows.map((row, i) => (
            <View key={i} style={styles.gridRow}>
              {row.map(draw)}
              {Array.from({ length: 5 - row.length }, (_, j) => (
                <View key={`pad${j}`} style={styles.cell} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Window>
  );
}

const styles = StyleSheet.create({
  specials: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 6, paddingTop: 12 },
  upright: { width: 1, marginHorizontal: 6, marginVertical: 4, backgroundColor: colors.border },
  rule: { height: 1, marginTop: 12, marginHorizontal: 20, backgroundColor: colors.border },
  grid: { rowGap: 12, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 16 },
  gridRow: { flexDirection: "row", columnGap: 2 },
  cell: { flex: 1 },
});
