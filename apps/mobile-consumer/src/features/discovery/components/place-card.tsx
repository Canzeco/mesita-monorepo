import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, PremierSeal, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, leading, motion, radius, text, tracking, weight } from "@/theme";

import { cardOffers, factsOf, placeholderOf, type CardOffer, type CatalogPlace } from "../model";
import { ScoreLabel, type Rank } from "./score-label";

type Props = {
  place: CatalogPlace;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
  /** A Google-only place: one Generate Profile button instead of Save and Share. */
  onGenerate?: () => void;
  onReserve?: () => void;
  /** The temporary score label (Discovery's Score overlay switch, MESITA-4757). */
  showScores?: boolean;
  ad?: boolean;
  rank?: Rank | null;
};

/** The web's card buttons: 32 tall, corner 8 (CARD_BUTTON_BOX). */
const BUTTON = 32;
/** The web's one 8 pt step: list, row, inside the info box (ROW_INFO p-2 gap-2). */
const STEP = 8;

/**
 * One place, the web's PlaceRowCard: the photo square on the left, the info
 * box on the right, touching. The square is the row's minimum; the info side
 * grows with its facts and buttons and the photo stretches with it
 * (MESITA-5024). The whole info box opens the place; Reserve, Save and Share
 * catch their own taps.
 */
export function PlaceCard({ place, saved, onOpen, onSave, onShare, onGenerate, onReserve, showScores = false, ad = false, rank = null }: Props) {
  const facts = factsOf(place);
  const offers = cardOffers(place);
  const google = place.googleOnly === true;
  const reservable = !google && place.reservable === true;
  const placeholder = placeholderOf(place);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.name}`}
        onPress={google ? onGenerate : onOpen}
        style={styles.photoBox}
      >
        <View style={styles.square} />
        {/* Drawn first: the web's Premier pill and offer box are z-10 above it. */}
        {place.photo ? (
          <Image
            source={place.photo}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={motion.fast}
            recyclingKey={place.id}
          />
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
        {showScores ? <ScoreLabel area={place.area ?? null} ad={ad} lane={place.lane ?? undefined} rank={rank} /> : null}
        {/* Premier at the photo's top-left, Save's width: (100% − 25) / 2
            (MESITA-5090, MESITA-5117). */}
        {place.isPremier ? (
          <View style={styles.premierRow} pointerEvents="none">
            <View style={styles.premier}>
              <PremierSeal size={16} color={colors.offerBox} check={colors.onInk} />
              <Text style={styles.premierWord}>Premier</Text>
            </View>
            <View style={styles.flex} />
          </View>
        ) : null}
        {/* Prepay left, Pay right, straight on the photo 8 in; each percent
            in a small black box (MESITA-5123, MESITA-5128). Under 360 the two
            stack, each the full width. */}
        {offers.length > 0 ? <OfferRow offers={offers} /> : null}
      </Pressable>

      <Pressable accessible={false} onPress={google ? onGenerate : onOpen} style={styles.info}>
        <View style={styles.words}>
          <Text numberOfLines={2} style={styles.name}>
            {place.name}
          </Text>
          {facts.price || facts.kind ? (
            <View style={styles.line}>
              {facts.price ? (
                <Text role="small" testID="place-price">
                  {facts.price}
                </Text>
              ) : null}
              {facts.price && facts.kind ? <Text role="small">·</Text> : null}
              {facts.kind ? (
                <Text role="small" numberOfLines={1} style={styles.shrink}>
                  {facts.kind}
                </Text>
              ) : null}
            </View>
          ) : null}
          {facts.rating || facts.distance ? (
            <View style={styles.line}>
              {facts.rating ? (
                <View style={styles.pair}>
                  <Icon strokeWidth={2} name="star-filled" size={14} color={colors.ink} />
                  <Text role="small">{facts.rating}</Text>
                  {facts.reviews ? <Text role="small">{`(${facts.reviews})`}</Text> : null}
                </View>
              ) : null}
              {facts.rating && facts.distance ? <Text role="small">·</Text> : null}
              {facts.distance ? (
                <View style={[styles.pair, styles.shrink]}>
                  <Icon strokeWidth={2} name="navigation-filled" size={14} color={colors.ink} />
                  <Text role="small" numberOfLines={1} style={styles.shrink}>
                    {facts.distance}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {facts.open ? (
            <View style={styles.line}>
              <Icon strokeWidth={2} name="clock" size={14} color={colors.ink} />
              <Text role="small">{facts.open.now ? "Open" : "Closed"}</Text>
              {facts.open.when ? (
                <Text role="small" numberOfLines={1} style={styles.shrink} testID="place-hours">{`· ${facts.open.when}`}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* What you can do, pinned to the box's bottom: Reserve the full
            width (MESITA-5091), then Save · Share on one 8 pt grid. */}
        <View style={styles.buttons}>
          {reservable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reserve at ${place.name}`}
              onPress={onReserve ?? onOpen}
              style={styles.reserve}
            >
              <Icon strokeWidth={2} name="calendar-check" size={16} color={colors.onInk} />
              <Text style={styles.reserveWord}>Reserve</Text>
            </Pressable>
          ) : null}
          {onGenerate && google ? (
            <View style={styles.actions}>
              <CardButton icon="sparkles" label="Generate Profile" spoken={`Generate ${place.name}'s profile`} onPress={onGenerate} />
            </View>
          ) : (
            <View style={styles.actions}>
              <CardButton
                icon={saved ? "heart-filled" : "heart"}
                label={saved ? "Saved" : "Save"}
                spoken={saved ? `Remove ${place.name} from favorites` : `Add ${place.name} to favorites`}
                onPress={onSave}
              />
              <CardButton icon="share-2" label="Share" spoken={`Share ${place.name}`} onPress={onShare} />
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

/** The photo's offers, the web's flex flex-wrap gap-1 with min-w-max
 *  flex-[1_1_0] cells: never narrower than their content, equal halves where
 *  both fit, else they wrap and stack. Each content is measured by a hidden
 *  copy laid out across the whole row, so a label wider than half still
 *  claims its width. */
function OfferRow({ offers }: { offers: CardOffer[] }) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  return (
    <View style={styles.offerBox} pointerEvents="none" accessibilityLabel={offers.map((o) => o.words).join(", ")}>
      {offers.map((o) => (
        <View
          key={o.key}
          style={[styles.offer, o.key === "prepay" ? styles.prepay : styles.pay, widths[o.key] ? { minWidth: Math.ceil(widths[o.key]) + 6 } : null]}
        >
          <OfferContent offer={o} />
        </View>
      ))}
      {offers.map((o) => (
        <View
          key={`measure-${o.key}`}
          style={styles.measure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setWidths((was) => (was[o.key] === w ? was : { ...was, [o.key]: w }));
          }}
        >
          <OfferContent offer={o} />
        </View>
      ))}
    </View>
  );
}

function OfferContent({ offer }: { offer: CardOffer }) {
  const prepay = offer.key === "prepay";
  return (
    <View style={styles.offerInner}>
      <Text numberOfLines={1} style={[styles.offerWords, prepay ? styles.onPrepay : styles.onPay]}>
        {offer.word}
      </Text>
      <View style={styles.pct}>
        <Text numberOfLines={1} style={styles.pctWords}>{`${offer.pct}%`}</Text>
      </View>
    </View>
  );
}

type ButtonProps = { icon: IconName; label: string; spoken: string; onPress: () => void };

/** The web's CardActions button on Home: white with a hairline (MESITA-4432). */
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

const styles = StyleSheet.create({
  card: { flexDirection: "row" },
  flex: { flex: 1 },
  photoBox: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: radius["2xl"],
    borderBottomLeftRadius: radius["2xl"],
    backgroundColor: colors.fill,
  },
  square: { width: "100%", aspectRatio: 1 },
  placeholder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  emoji: { ...text["4xl"], lineHeight: text["4xl"].fontSize },
  initial: { ...text["2xl"], lineHeight: text["2xl"].fontSize, fontWeight: weight.bold, letterSpacing: text["2xl"].fontSize * tracking.tight },
  // The info box spends 1 of border and 8 of padding on its right: the
  // same inset here makes the pill exactly Save's width.
  premierRow: { position: "absolute", top: STEP, left: STEP, right: STEP + 1, flexDirection: "row", gap: STEP },
  premier: {
    flex: 1,
    height: BUTTON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.offerBox,
    borderRadius: radius.lg,
    backgroundColor: colors.vip,
  },
  premierWord: { ...text.sm, fontWeight: weight.semibold, color: colors.onPremier },
  offerBox: { position: "absolute", left: STEP, right: STEP, bottom: STEP, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  offer: { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: BUTTON, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderRadius: radius.lg },
  // gap-0.5 from word to percent; the content row is measured, never squeezed.
  offerInner: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  // Hidden, across the whole row (left and right 0), content-sized.
  measure: { position: "absolute", top: 0, left: 0, opacity: 0, alignSelf: "flex-start", flexDirection: "row" },
  // rounded, bg-neutral-950, px-[3px] py-0.5, leading-none, white.
  pct: { paddingHorizontal: 3, paddingVertical: 2, borderRadius: radius.base, backgroundColor: colors.percentBox },
  pctWords: { ...text.xs, lineHeight: text.xs.fontSize, fontWeight: weight.semibold, fontVariant: ["tabular-nums"], color: colors.onInk },
  prepay: { backgroundColor: colors.prepay },
  pay: { backgroundColor: colors.pay },
  offerWords: { ...text.xs, fontWeight: weight.semibold, fontVariant: ["tabular-nums"] },
  onPrepay: { color: colors.onPrepay },
  onPay: { color: colors.onPay },
  info: {
    flex: 1,
    gap: STEP,
    padding: STEP,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    borderTopRightRadius: radius["2xl"],
    borderBottomRightRadius: radius["2xl"],
  },
  words: { gap: 2 },
  // 16 px, leading-snug (1.375), semibold, tracking-tight.
  name: { ...text.base, lineHeight: text.base.fontSize * leading.snug, fontWeight: weight.semibold, letterSpacing: text.base.fontSize * tracking.tight },
  shrink: { flexShrink: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  pair: { flexDirection: "row", alignItems: "center", gap: 2 },
  buttons: { marginTop: "auto", gap: STEP },
  reserve: {
    height: BUTTON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: STEP,
    borderRadius: radius.lg,
    backgroundColor: colors.reserve,
  },
  reserveWord: { ...text.xs, fontWeight: weight.semibold, color: colors.onInk },
  actions: { flexDirection: "row", gap: STEP },
  button: {
    flex: 1,
    height: BUTTON,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: STEP,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
  },
  /** The web's active:scale-[0.99] on the card's buttons. */
  pressed: { transform: [{ scale: 0.99 }] },
});
