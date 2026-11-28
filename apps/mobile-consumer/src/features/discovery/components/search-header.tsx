import { Image } from "expo-image";
import { useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Pulse } from "@/components/skeleton";
import { Text } from "@/components/text";
import { Window } from "@/components/window";
import { colors, disabledOpacity, maxFontSizeMultiplier, radius, shadow, text, weight } from "@/theme";

import { isSpecial, type Chip, type ChipKey } from "../families";

export type Locate = "idle" | "locating" | "located" | "blocked";

type Props = {
  term: string;
  onTerm: (term: string) => void;
  field: RefObject<ComponentRef<typeof TextInput> | null>;
  onFocus: (focused: boolean) => void;
  locate: Locate;
  onLocate: () => void;
  chips: readonly Chip[];
  chosen: ChipKey;
  onChip: (key: ChipKey) => void;
  onMenu: () => void;
  /** Hidden once a query runs (the web's chipsHidden). */
  chipsHidden: boolean;
  /** Over the chips: the results list or a sign-in box. */
  children?: ReactNode;
};

/** The web's SearchHeader: the floating bar (locate · the field · Ask AI),
 *  then Menu pinned and the chips sliding beside it. */
export function SearchHeader({ field, ...props }: Props) {
  const [ask, setAsk] = useState(false);
  const [focused, setFocused] = useState(false);
  const filtered = !isSpecial(props.chosen);
  return (
    <View pointerEvents="box-none">
      <View style={styles.barRow}>
        <View style={[styles.bar, focused && styles.barFocused]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              props.locate === "locating" ? "Locating" : props.locate === "located" ? "Recentre on your location" : "Use my location"
            }
            accessibilityState={{ disabled: props.locate === "locating", busy: props.locate === "locating" }}
            disabled={props.locate === "locating"}
            onPress={props.onLocate}
            testID="locate"
            style={({ pressed }) => [styles.locate, pressed && styles.pressedFill]}
          >
            <Pulse on={props.locate === "locating"} style={props.locate === "locating" ? styles.off : undefined}>
              <Icon strokeWidth={2} name="locate-fixed" size={16} color={props.locate === "blocked" ? colors.danger : colors.ink} />
            </Pulse>
          </Pressable>
          <View style={styles.query}>
            <Icon strokeWidth={2} name="search" size={16} color={colors.muted} />
            <TextInput
              ref={field}
              value={props.term}
              onChangeText={props.onTerm}
              onFocus={() => {
                setFocused(true);
                props.onFocus(true);
              }}
              onBlur={() => {
                setFocused(false);
                props.onFocus(false);
              }}
              placeholder="Search places…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="search"
              onSubmitEditing={() => field.current?.blur()}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              style={styles.field}
              testID="search-field"
            />
            {props.term ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => props.onTerm("")} style={styles.clear}>
                <Icon strokeWidth={2} name="x" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask AI"
            onPress={() => setAsk(true)}
            style={({ pressed }) => [styles.ai, pressed && styles.pressedFill]}
          >
            <AiSparkle />
            <Text role="label">AI</Text>
          </Pressable>
        </View>
      </View>
      <View>
        {props.chipsHidden ? null : (
          <View style={styles.chipRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={filtered ? "Menu, a family is chosen" : "Menu"}
              onPress={props.onMenu}
              testID="menu"
              style={({ pressed }) => [styles.chip, filtered ? styles.chipFiltered : styles.chipOff, pressed && styles.chipPressed]}
            >
              <Icon strokeWidth={2} name="layout-grid" size={16} color={filtered ? colors.onInk : colors.ink} />
              <Text role="label" tone={filtered ? "onInk" : "ink"}>
                Menu
              </Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
              {props.chips.map((row) => {
                const on = row.key === props.chosen;
                return (
                  <Pressable
                    key={row.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={row.label}
                    onPress={() => props.onChip(row.key)}
                    style={({ pressed }) => [styles.chip, on ? styles.chipOn : styles.chipOff, pressed && styles.chipPressed]}
                  >
                    <Image source={row.picture} style={styles.chipMark} contentFit="contain" accessible={false} />
                    <Text role="label" tone={on ? "onInk" : "ink"}>
                      {row.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        {props.children ? <View style={styles.over}>{props.children}</View> : null}
      </View>
      <Modal visible={ask} transparent animationType="fade" onRequestClose={() => setAsk(false)}>
        <Window title="Ask AI" label="Ask AI" onClose={() => setAsk(false)}>
          <View style={styles.soon}>
            <EmptyState
              icon="bot-message-square"
              title="Ask AI is coming soon"
              message="We're adding Ask AI in the next version of Mesita."
            />
          </View>
        </Window>
      </Modal>
    </View>
  );
}

/** The web's AiSparkle: two four-point stars with curved sides, filled, a 1.2 round stroke. */
function star(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return (
    `M${cx} ${cy - r}` +
    `Q${cx + k} ${cy - k} ${cx + r} ${cy}` +
    `Q${cx + k} ${cy + k} ${cx} ${cy + r}` +
    `Q${cx - k} ${cy + k} ${cx - r} ${cy}` +
    `Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`
  );
}
const SPARKLE = `${star(10, 10, 8.8)}${star(18.2, 18.2, 4.4)}`;

function AiSparkle() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
      <Path d={SPARKLE} fill={colors.ink} stroke={colors.ink} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

const FLOAT = { backgroundColor: colors.paper, boxShadow: shadow.float } as const;

const styles = StyleSheet.create({
  barRow: { paddingHorizontal: 12, paddingTop: 12 },
  bar: {
    ...FLOAT,
    height: 48,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.full,
  },
  barFocused: { borderColor: colors.ink },
  // pl-4 pr-3, a hairline after it.
  locate: { alignItems: "center", justifyContent: "center", paddingLeft: 16, paddingRight: 12, borderRightWidth: 1, borderRightColor: colors.border },
  pressedFill: { backgroundColor: colors.fill },
  off: { opacity: disabledOpacity },
  // pl-3 pr-1 around the bar's own Search icon, field and clear.
  query: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 4 },
  field: { flex: 1, minWidth: 0, height: 46, paddingHorizontal: 12, color: colors.ink, ...text.sm, fontWeight: weight.semibold },
  clear: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  // pl-4 pr-5, gap 6, a hairline before it.
  ai: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingLeft: 16, paddingRight: 20, borderLeftWidth: 1, borderLeftColor: colors.border },
  // pt-1 pl-3, every gap 8; the chips' own row py-2 pr-3 so the shadows show.
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, paddingLeft: 12 },
  chipScroll: { flex: 1, minWidth: 0 },
  chips: { alignItems: "center", gap: 8, paddingVertical: 8, paddingRight: 12 },
  chip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.full,
  },
  chipOff: FLOAT,
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink, boxShadow: shadow.float },
  chipFiltered: { backgroundColor: colors.danger, borderColor: colors.danger, boxShadow: shadow.float },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipMark: { width: 16, height: 16 },
  over: { position: "absolute", left: 12, right: 12, top: 0, paddingTop: 12, gap: 8 },
  soon: { minHeight: 256 },
});
