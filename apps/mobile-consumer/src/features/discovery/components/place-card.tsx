import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, PremierSeal, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, motion, pressedOpacity, radius, space } from "@/theme";

import { factsOf, type CatalogPlace } from "../model";

type Props = {
  place: CatalogPlace;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
};

/** One place: its photo on the left half, its facts and buttons on the right. */
export function PlaceCard({ place, saved, onOpen, onSave, onShare }: Props) {
  const facts = factsOf(place);
  return (
    <View style={styles.card}>
      <Pressable accessible={false} onPress={onOpen} style={styles.photoBox}>
        <Image
          source={place.photo}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={motion.fast}
          recyclingKey={place.id}
        />
      </Pressable>
      <View style={styles.info}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} onPress={onOpen} style={styles.words}>
          <View style={styles.title}>
            <Text role="strong" numberOfLines={2} style={styles.name}>
              {place.name}
            </Text>
            {place.isPremier ? <PremierSeal /> : null}
            {place.isPremier && place.isAd ? (
              <Text role="button" tone="muted">
                Ad
              </Text>
            ) : null}
          </View>
          {facts.kind ? (
            <Text role="small" tone="muted" numberOfLines={1}>
              {facts.kind}
            </Text>
          ) : null}
          {facts.price || facts.rating ? (
            <View style={styles.line}>
              {facts.price ? (
                <Text role="label" tone="price">
                  {facts.price}
                </Text>
              ) : null}
              {facts.price && facts.rating ? (
                <Text role="small" tone="muted">
                  ·
                </Text>
              ) : null}
              {facts.rating ? (
                <>
                  <Icon name="star-filled" size={14} color={colors.star} />
                  <Text role="small">{facts.rating}</Text>
                  {facts.reviews ? <Text role="small" tone="muted">{`(${facts.reviews})`}</Text> : null}
                </>
              ) : null}
            </View>
          ) : null}
          {facts.open ? (
            <View style={styles.line}>
              <Icon name="clock" size={14} color={facts.open.now ? colors.price : colors.closed} />
              <Text role="label" tone={facts.open.now ? "price" : "closed"}>
                {facts.open.now ? "Open" : "Closed"}
              </Text>
              {facts.open.when ? (
                <Text role="small" tone="muted" numberOfLines={1} style={styles.name}>{`· ${facts.open.when}`}</Text>
              ) : null}
            </View>
          ) : null}
          {facts.where ? (
            <View style={styles.line}>
              <Icon name="navigation-filled" size={14} color={colors.distance} />
              <Text role="small" tone="muted" numberOfLines={1} style={styles.name}>
                {facts.where}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <CardButton
            icon={saved ? "heart-filled" : "heart"}
            color={saved ? colors.danger : colors.ink}
            label={saved ? "Saved" : "Save"}
            spoken={saved ? `Remove ${place.name} from favorites` : `Add ${place.name} to favorites`}
            onPress={onSave}
          />
          <CardButton icon="share-2" color={colors.ink} label="Share" spoken={`Share ${place.name}`} onPress={onShare} />
        </View>
      </View>
    </View>
  );
}

type ButtonProps = { icon: IconName; color: string; label: string; spoken: string; onPress: () => void };

function CardButton({ icon, color, label, spoken, onPress }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { opacity: pressedOpacity }]}
    >
      <Icon name={icon} size={16} color={color} />
      <Text role="button">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", marginHorizontal: space.sm, marginTop: space.sm },
  photoBox: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
    backgroundColor: colors.fill,
  },
  info: {
    flex: 1,
    aspectRatio: 1,
    padding: space.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    borderTopRightRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  words: { flex: 1, gap: 2 },
  title: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  name: { flexShrink: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { flexDirection: "row", gap: space.sm },
  button: {
    flex: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.paper,
  },
});
