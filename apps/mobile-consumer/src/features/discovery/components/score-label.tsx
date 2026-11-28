import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, fontMono, leading, radius, text, weight } from "@/theme";

import type { Area } from "../model";

/** The merged rank before the first page's shuffle, and the shown position. */
export type Rank = { pre: number | null; shown: number };

/** A lane key's name on the label (MESITA-4517). */
const LANE_NAMES: Record<string, string> = {
  catalogNearbyOrganic: "Home Nearby Organic",
  catalogNearbyInorganic: "Home Nearby Inorganic",
  catalogPopularOrganic: "Home Popular Organic",
  catalogPopularInorganic: "Home Popular Inorganic",
  catalogFamilyClose: "Home Family Organic",
  catalogFamilyCloseInorganic: "Home Family Inorganic",
};

/** Four significant digits; under 0.0001 in scientific form; missing reads n/a. */
function scoreNumber(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  if (n === 0) return "0";
  if (Math.abs(n) < 1e-4) return n.toExponential(2);
  return String(Number(n.toPrecision(4)));
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * TEMPORARY, as on the web (MESITA-4449): the server's score parts on the
 * photo, so Discovery's knobs can be judged on a phone. Every number is the
 * row's `area`; nothing is computed here. Discovery's Score overlay switch
 * turns it off without a build. TO REMOVE with the web's.
 */
export function ScoreLabel({ area, ad, lane, rank }: { area: Area | null; ad: boolean; lane?: string; rank: Rank | null }) {
  if (!area) return null;
  const head = rank ? (rank.pre !== null ? `#${rank.pre} → ${ordinal(rank.shown)}` : ordinal(rank.shown)) : null;
  const rows: [string, string][] = [
    ["Lane", (lane && LANE_NAMES[lane]) || (ad ? "Inorganic" : "Organic")],
    ...(area.google !== null ? [["Google", scoreNumber(area.google)] as [string, string]] : []),
    ...(area.foursquare ? [["Foursquare", `×${scoreNumber(area.foursquare.boost)}`] as [string, string]] : []),
    ["Popularity", scoreNumber(area.signals.popularity)],
    ["Proximity", scoreNumber(area.signals.proximity)],
    ["Premier", `×${scoreNumber(area.premierBoost ?? area.selectedFactor ?? 1)}`],
    ["Final", scoreNumber(area.final)],
  ];
  const all: [string, string, boolean][] = [
    ...(head || ad ? [[ad ? "Ad" : "", head ?? "", true] as [string, string, boolean]] : []),
    ...rows.map(([k, v]) => [k, v, k === "Final"] as [string, string, boolean]),
  ];
  return (
    <View style={styles.box} pointerEvents="none" accessibilityLabel="Score breakdown (temporary)">
      <View style={styles.column}>
        {all.map(([k, , bold], i) => (
          <Text key={`k${i}`} style={[styles.cell, bold && styles.bold]}>
            {k}
          </Text>
        ))}
      </View>
      <View style={styles.column}>
        {all.map(([, v, bold], i) => (
          <Text key={`v${i}`} style={[styles.cell, styles.right, bold && styles.bold]}>
            {v}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // top-2 right-2, rounded-md, px-2 py-1, gap-x-2, black at 70%.
  box: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.scoreScrim,
  },
  column: {},
  // type-label, font-mono, leading-tight (1.25), white, tabular-nums.
  cell: { ...text.label, fontFamily: fontMono, lineHeight: text.label.fontSize * leading.tight, color: colors.onInk, fontVariant: ["tabular-nums"] },
  right: { textAlign: "right" },
  bold: { fontWeight: weight.bold },
});
