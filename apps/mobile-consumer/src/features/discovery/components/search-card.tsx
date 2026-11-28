import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, PremierSeal, type IconName } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { colors, radius, shadow, text, tracking, weight } from "@/theme";

import { offerSlides } from "@/generated/shared/lib/offers";

import { cardOffers, factsOf, placeholderOf, type CatalogPlace, type Facts } from "../model";

/** The web's rail card: 134 tall with its border, 166 with the band (h-[8.375rem], h-[10.375rem]). */
export const CARD_HEIGHT = 134;
export const CARD_WITH_BAND_HEIGHT = 166;
/** The photo and text row, the card's inner height. */
const ROW = 132;
const BUTTON = 32;

/** Widths for cells that share a row the CSS grid way (auto-cols-[minmax(max-content,1fr)]):
 *  equal shares, except a cell wider than its share keeps its own width and
 *  the rest share what is left. */
export function fitCells(mins: readonly number[], row: number): number[] {
  const widths: (number | null)[] = mins.map(() => null);
  for (;;) {
    const free = widths.flatMap((w, i) => (w === null ? [i] : []));
    if (free.length === 0) break;
    const left = row - widths.reduce<number>((sum, w) => sum + (w ?? 0), 0);
    const share = left / free.length;
    const over = free.filter((i) => (mins[i] ?? 0) > share);
    if (over.length === 0) {
      for (const i of free) widths[i] = share;
      break;
    }
    for (const i of over) widths[i] = mins[i] ?? 0;
  }
  return widths.map((w) => w ?? 0);
}

type Cell = { key: string; tone: "premier" | "reserve" | "prepay" | "pay"; body: ReactNode; label: string; onPress?: () => void };

/** The band across the card's top: Premier, Reserve, Prepay, Pay, each in its
 *  colour, sharing the row (the web's PlaceBannerRow with `premier` and
 *  `offers`, MESITA-5094, 5129, 5131). */
function Band({ cells }: { cells: Cell[] }) {
  const [mins, setMins] = useState<Record<string, number>>({});
  const [row, setRow] = useState(0);
  const measured = cells.every((c) => mins[c.key] !== undefined) && row > 0;
  const widths = measured ? fitCells(cells.map((c) => Math.ceil(mins[c.key] ?? 0) + 6), row) : null;
  return (
    <View style={styles.band} onLayout={(e) => setRow(e.nativeEvent.layout.width)}>
      {cells.map((c, i) => {
        const style = [styles.cell, styles[c.tone], widths ? { width: widths[i] } : styles.flex];
        const inner = <View style={styles.cellInner}>{c.body}</View>;
        return c.onPress ? (
          <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={c.label} onPress={c.onPress} style={style}>
            {inner}
          </Pressable>
        ) : (
          <View key={c.key} accessibilityLabel={c.label} style={style}>
            {inner}
          </View>
        );
      })}
      {/* Measured off the cells: an absolute child of a row sizes to its content. */}
      {cells.map((c) => (
        <View
          key={`measure-${c.key}`}
          style={styles.measure}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setMins((was) => (was[c.key] === w ? was : { ...was, [c.key]: w }));
          }}
        >
          <View style={styles.cellInner}>{c.body}</View>
        </View>
      ))}
    </View>
  );
}

function Percent({ pct }: { pct: number }) {
  return (
    <View style={styles.pct}>
      <Text numberOfLines={1} style={styles.pctWords}>{`${pct}%`}</Text>
    </View>
  );
}

type Props = {
  place: CatalogPlace;
  width: number;
  selected: boolean;
  saved: boolean;
  onOpen: () => void;
  onReserve: () => void;
  onSave: () => void;
  onShare: () => void;
};

/** One card on Search's rail: the web's RailCard. One tap opens the place;
 *  Reserve, Save and Share catch their own. */
export function SearchCard({ place, width, selected, saved, onOpen, onReserve, onSave, onShare }: Props) {
  const facts = factsOf(place);
  const google = place.googleOnly === true;
  const reservable = !google && place.reservable === true;
  const offers = cardOffers(place);
  const placeholder = placeholderOf(place);
  const cells: Cell[] = [
    ...(place.isPremier
      ? [{ key: "premier", tone: "premier" as const, label: "Premier", body: (
          <>
            <PremierSeal size={16} color={colors.offerBox} check={colors.onInk} />
            <Text numberOfLines={1} style={[styles.cellWords, styles.onPremier]}>Premier</Text>
          </>
        ) }]
      : []),
    ...(reservable
      ? [{ key: "reserve", tone: "reserve" as const, label: `Reserve at ${place.name}`, onPress: onReserve, body: (
          <>
            <Icon strokeWidth={2} name="calendar-check" size={16} color={colors.onInk} />
            <Text numberOfLines={1} style={[styles.cellWords, styles.onReserve]}>Reserve</Text>
          </>
        ) }]
      : []),
    ...offers.map((o) => ({
      key: o.key,
      tone: o.key,
      label: `${o.words} at ${place.name}`,
      onPress: onOpen,
      body: (
        <View style={styles.offerInner}>
          <Text numberOfLines={1} style={[styles.cellWords, o.key === "prepay" ? styles.onPrepay : styles.onPay]}>
            {o.word}
          </Text>
          <Percent pct={o.pct} />
        </View>
      ),
    })),
  ];
  // The web shows the band whenever the place has any offer slide, an empty
  // strip when no cell draws (SearchRailCard `banner`).
  const band = cells.length > 0 || offerSlides(google ? null : place.offers).length > 0;
  // The text column starts a third in; Save · Share start a third in plus 12.
  const inner = width - 2;
  return (
    <View style={[styles.frame, { width, height: band ? CARD_WITH_BAND_HEIGHT : CARD_HEIGHT }, selected && styles.selected]}>
      {band ? cells.length > 0 ? <Band cells={cells} /> : <View style={styles.band} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} onPress={onOpen} style={styles.row}>
        <View style={[styles.photo, { width: inner / 3 }]}>
          {place.photo ? (
            <Image source={place.photo} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={place.id} />
          ) : (
            <View style={styles.placeholder}>
              {placeholder.kind === "emoji" ? (
                <Text style={styles.emoji}>{placeholder.emoji}</Text>
              ) : (
                <Text tone="muted" style={styles.initial}>
                  {placeholder.text}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {place.name}
          </Text>
          <PriceKindRow facts={facts} />
          <StarsOpenRow facts={facts} />
        </View>
      </Pressable>
      <View style={[styles.actions, { left: inner / 3 + 12 }]}>
        {google ? (
          <CardButton icon="sparkles" label="Generate Profile" spoken={`Generate ${place.name}'s profile`} onPress={onOpen} />
        ) : (
          <>
            <CardButton
              icon={saved ? "heart-filled" : "heart"}
              label={saved ? "Saved" : "Save"}
              spoken={saved ? `Remove ${place.name} from favorites` : `Add ${place.name} to favorites`}
              onPress={onSave}
            />
            <CardButton icon="share-2" label="Share" spoken={`Share ${place.name}`} onPress={onShare} />
          </>
        )}
      </View>
      {selected ? <View pointerEvents="none" style={styles.ring} /> : null}
    </View>
  );
}

/** Row two: $$ · category (the web's PriceKindRow). */
function PriceKindRow({ facts }: { facts: Facts }) {
  if (!facts.kind && !facts.price) return null;
  return (
    <View style={styles.line}>
      {facts.price ? <Text role="small">{facts.price}</Text> : null}
      {facts.kind && facts.price ? <Text role="small">·</Text> : null}
      {facts.kind ? (
        <Text role="small" numberOfLines={1} style={styles.shrink}>
          {facts.kind}
        </Text>
      ) : null}
    </View>
  );
}

/** Row three: ★ rating (reviews) · Open or Closed (the web's StarsOpenRow). */
function StarsOpenRow({ facts }: { facts: Facts }) {
  if (!facts.rating && !facts.open) return null;
  return (
    <View style={styles.line}>
      {facts.rating ? (
        <View style={styles.group}>
          <Icon strokeWidth={2} name="star-filled" size={14} color={colors.ink} />
          <Text role="small">{facts.rating}</Text>
          {facts.reviews ? <Text role="small">{`(${facts.reviews})`}</Text> : null}
        </View>
      ) : null}
      {facts.rating && facts.open ? <Text role="small">·</Text> : null}
      {facts.open ? (
        <View style={styles.group}>
          <Icon strokeWidth={2} name="clock" size={14} color={colors.ink} />
          <Text role="small">{facts.open.now ? "Open" : "Closed"}</Text>
        </View>
      ) : null}
    </View>
  );
}

type ButtonProps = { icon: IconName; label: string; spoken: string; onPress: () => void };

/** The web's CardActions button: grey (bg-border/60), no border. */
function CardButton({ icon, label, spoken, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon strokeWidth={2} name={icon} size={14} color={colors.ink} />
      <Text role="small" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The card while the map loads: the same frame, rows and buttons (the web's RailCardSkeleton). */
export function SearchCardSkeleton({ width }: { width: number }) {
  const inner = width - 2;
  return (
    <View style={[styles.frame, { width, height: CARD_HEIGHT }]} accessibilityElementsHidden>
      <View style={styles.row}>
        <Skeleton style={{ width: inner / 3, height: ROW, borderRadius: 0 }} />
        <View style={styles.text}>
          <View style={styles.skeletonRow}>
            <Skeleton style={{ height: 16, width: "75%" }} />
          </View>
          <View style={styles.skeletonRow}>
            <Skeleton style={{ height: 14, width: "50%" }} />
          </View>
          <View style={styles.skeletonRow}>
            <Skeleton style={{ height: 14, width: "60%" }} />
          </View>
        </View>
      </View>
      <View style={[styles.actions, { left: inner / 3 + 12 }]}>
        <Skeleton style={styles.skeletonButton} />
        <Skeleton style={styles.skeletonButton} />
      </View>
    </View>
  );
}

/** The rail's first page, and the empty area's only card (the web's AddPlaceButton). */
export function AddCard({ width, empty, filterLabel, onAdd }: { width: number; empty: boolean; filterLabel: string | null; onAdd: () => void }) {
  const line =
    empty && filterLabel
      ? `Nothing here for ${filterLabel} yet. Takes under 10 seconds.`
      : empty
        ? "Nothing here yet. Takes under 10 seconds."
        : "Not on Mesita yet? Takes under 10 seconds.";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Add a place" onPress={onAdd} style={[styles.add, { width }]} testID="search-add">
      {({ pressed }) => (
        <>
          <Text style={styles.addHead}>Add a new place to Mesita</Text>
          <Text style={styles.addLine}>{line}</Text>
          <View style={[styles.addCta, pressed && styles.ctaPressed]}>
            <Icon strokeWidth={2} name="zap" size={16} color={colors.ink} fill />
            <Text role="label">Add a place</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flexGrow: 1, flexBasis: 0 },
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
    backgroundColor: colors.paperGlass,
    boxShadow: shadow.elev,
  },
  selected: { borderColor: colors.ink },
  // ring-2 ring-inset, primary at 30%, inside the 1 pt border.
  ring: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: colors.inkRing, borderRadius: radius["2xl"] - 1 },
  band: { height: BUTTON, flexDirection: "row" },
  cell: {
    height: BUTTON,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.priceLine,
  },
  cellInner: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  offerInner: { flexDirection: "row", alignItems: "center", gap: 2 },
  measure: { position: "absolute", top: 0, left: 0, opacity: 0, flexDirection: "row" },
  premier: { backgroundColor: colors.vip },
  reserve: { backgroundColor: colors.reserve },
  prepay: { backgroundColor: colors.prepay },
  pay: { backgroundColor: colors.pay },
  cellWords: { ...text.xs, fontWeight: weight.semibold },
  onPremier: { color: colors.onPremier },
  onReserve: { color: colors.onInk },
  onPrepay: { color: colors.onPrepay },
  onPay: { color: colors.onPay },
  pct: { paddingHorizontal: 3, paddingVertical: 2, borderRadius: radius.base, backgroundColor: colors.percentBox },
  pctWords: { ...text.xs, lineHeight: text.xs.fontSize, fontWeight: weight.semibold, fontVariant: ["tabular-nums"], color: colors.onInk },
  row: { height: ROW, flexDirection: "row" },
  photo: { height: ROW, overflow: "hidden", backgroundColor: colors.fill },
  placeholder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  emoji: { ...text["5xl"], lineHeight: text["5xl"].fontSize },
  initial: { ...text["3xl"], fontWeight: weight.bold, letterSpacing: text["3xl"].fontSize * tracking.tight },
  text: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 12, paddingTop: 12 },
  // text-base leading-5 font-semibold tracking-tight.
  name: { ...text.base, lineHeight: text.sm.lineHeight, fontWeight: weight.semibold, letterSpacing: text.base.fontSize * tracking.tight },
  line: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  group: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  shrink: { flexShrink: 1 },
  actions: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8 },
  button: {
    flex: 1,
    height: BUTTON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.buttonGrey,
  },
  pressed: { transform: [{ scale: 0.99 }] },
  skeletonRow: { height: 20, justifyContent: "center" },
  skeletonButton: { flex: 1, height: BUTTON },
  add: {
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 20,
    borderRadius: radius["2xl"],
    backgroundColor: colors.ink,
    boxShadow: shadow.elev,
  },
  addHead: { ...text.base, lineHeight: text.sm.lineHeight, fontWeight: weight.semibold, letterSpacing: text.base.fontSize * tracking.tight, color: colors.paper, textAlign: "center" },
  addLine: { ...text.sm, color: colors.onInkSoft, textAlign: "center" },
  addCta: {
    marginTop: 8,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    backgroundColor: colors.paper,
  },
  ctaPressed: { transform: [{ scale: 0.96 }] },
});
