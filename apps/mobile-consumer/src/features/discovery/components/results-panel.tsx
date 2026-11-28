import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { colors, radius, shadow } from "@/theme";

import type { Suggestion } from "../api";

type Props = {
  rows: Suggestion[];
  searching: boolean;
  /** The failure's words, or null. */
  error: string | null;
  maxHeight: number;
  /** A visitor: sign in to search by name. */
  onSignIn?: () => void;
  onPick: (row: Suggestion) => void;
  onAction: (row: Suggestion) => void;
  onRetry: () => void;
  onClear: () => void;
};

/** The bar's results (the web's SearchResultsPanel in its box): as tall as
 *  its rows, never taller than the cap. */
export function ResultsPanel(props: Props) {
  const { rows, searching, error } = props;
  const settled = !searching && !error;
  return (
    <View style={[styles.box, { maxHeight: props.maxHeight }]} testID="search-results">
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {searching && rows.length === 0 ? (
          <View style={styles.searching}>
            <Spinner size="sm" />
            <Text role="caption" tone="muted">
              Searching…
            </Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.failed}>
            <View style={styles.errorBox}>
              <Text role="caption" tone="danger">
                {error}
              </Text>
            </View>
            <SmallButton label="Try again" icon="rotate-cw" onPress={props.onRetry} />
          </View>
        ) : null}
        {settled && rows.length === 0 && props.onSignIn ? (
          <Notice icon="log-in" title="Sign in to search by name" line="Or clear the search to browse the map." button="Sign in" onPress={props.onSignIn} />
        ) : null}
        {settled && rows.length === 0 && !props.onSignIn ? (
          <Notice
            icon="search-x"
            title="No matches found"
            line="Try the full name, or clear the search to browse the map."
            button="Clear search"
            onPress={props.onClear}
          />
        ) : null}
        {rows.map((row, i) => (
          <Line key={row.mesitaId ?? row.placeId} row={row} first={i === 0} onPick={() => props.onPick(row)} onAction={() => props.onAction(row)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** One result: the web's PlaceActionRow. A place has Open or Generate on its right. */
function Line({ row, first, onPick, onAction }: { row: Suggestion; first: boolean; onPick: () => void; onAction: () => void }) {
  const spoken = `${row.mainText}${row.secondaryText ? `, ${row.secondaryText}` : ""}`;
  const location = row.kind === "location";
  const tone = location ? "" : row.premier ? "Mesita Premier" : row.onMesita ? "Basic Mesita profile" : "No profile yet";
  return (
    <View style={[styles.row, !first && styles.divided]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={location ? spoken : `${spoken}, ${tone}`}
        onPress={onPick}
        style={({ pressed }) => [styles.body, pressed && styles.dim]}
      >
        <View style={styles.mark}>
          <Icon strokeWidth={2.25} name={location ? "map" : "map-pin"} size={20} color={location ? colors.distance : colors.closed} />
        </View>
        <View style={styles.words}>
          <Text role="label" numberOfLines={1}>
            {row.mainText}
          </Text>
          {row.secondaryText ? (
            <Text role="caption" tone="muted" numberOfLines={1}>
              {row.secondaryText}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {location ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.onMesita ? "Open" : "Generate a profile for"} ${row.mainText}`}
          onPress={onAction}
          style={({ pressed }) => [styles.action, row.onMesita ? styles.open : styles.generate, pressed && styles.actionPressed]}
        >
          {row.onMesita ? null : <Icon strokeWidth={2.25} name="sparkles" size={14} color={colors.paper} />}
          <Text role="button" tone={row.onMesita ? "ink" : "paper"}>
            {row.onMesita ? "Open" : "Generate"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Notice({ icon, title, line, button, onPress }: { icon: IconName; title: string; line: string; button: string; onPress: () => void }) {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeMark}>
        <Icon strokeWidth={2} name={icon} size={16} color={colors.muted} />
      </View>
      <Text role="label" style={styles.noticeTitle}>
        {title}
      </Text>
      <Text role="caption" tone="muted" style={styles.noticeLine}>
        {line}
      </Text>
      <View style={styles.noticeButton}>
        <SmallButton label={button} onPress={onPress} />
      </View>
    </View>
  );
}

/** The web's h-9 bordered pill: 12 semibold, px 14. */
export function SmallButton({ label, icon, onPress, filled = false }: { label: string; icon?: IconName; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.small, filled && styles.smallFilled, pressed && styles.smallPressed]}
    >
      {icon ? <Icon strokeWidth={2} name={icon} size={14} color={colors.ink} /> : null}
      <Text role="button">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // border, bg-card/95, shadow-elev, rounded-2xl (its blur is not drawn).
  box: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
    backgroundColor: colors.paperGlass,
    boxShadow: shadow.elev,
  },
  inner: { padding: 12 },
  searching: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  failed: { alignItems: "center", gap: 8, paddingVertical: 4 },
  errorBox: { alignSelf: "stretch", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl, backgroundColor: colors.dangerSoft },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  body: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.lg },
  dim: { opacity: 0.7 },
  mark: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  words: { flex: 1, minWidth: 0 },
  action: { height: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: radius.full },
  open: { backgroundColor: colors.fill },
  generate: { backgroundColor: colors.ink },
  actionPressed: { transform: [{ scale: 0.97 }] },
  notice: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  noticeMark: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius["2xl"], backgroundColor: colors.fill },
  noticeTitle: { marginTop: 10, textAlign: "center" },
  noticeLine: { marginTop: 4, textAlign: "center" },
  noticeButton: { marginTop: 12 },
  small: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  smallFilled: { backgroundColor: colors.paper },
  smallPressed: { transform: [{ scale: 0.98 }] },
});
