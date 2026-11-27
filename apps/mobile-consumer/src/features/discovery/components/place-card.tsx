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
        <Pressable accessible={false} onPress={onOpen} style={styles.words}>
          <View style={styles.title}>
            <Text
              role="strong"
              numberOfLines={2}
              style={styles.name}
              accessibilityRole="button"
              accessibilityLabel={`Open ${place.name}`}
            >
              {place.name}
            </Text>
            {place.isPremier ? <PremierSeal color={place.isAd ? colors.ad : colors.premier} /> : null}
          </View>
          {facts.price || facts.kind ? (
            <View style={styles.line}>
              {facts.price ? (
                <Text role="small" testID="place-price">
                  {facts.price}
                </Text>
              ) : null}
              {facts.price && facts.kind ? <Text role="small">·</Text> : null}
              {facts.kind ? (
                <Text role="small" numberOfLines={1} style={styles.name}>
                  {facts.kind}
                </Text>
              ) : null}
            </View>
          ) : null}
          {facts.rating || facts.distance ? (
            <View style={styles.line}>
              {facts.rating ? (
                <>
                  <Icon name="star-filled" size={14} color={colors.ink} />
                  <Text role="small">{facts.rating}</Text>
                  {facts.reviews ? <Text role="small">{`(${facts.reviews})`}</Text> : null}
                </>
              ) : null}
              {facts.rating && facts.distance ? <Text role="small">·</Text> : null}
              {facts.distance ? (
                <Text role="small" numberOfLines={1} style={styles.name}>
                  {facts.distance}
                </Text>
              ) : null}
            </View>
          ) : null}
          {facts.open ? (
            <View style={styles.line}>
              <Icon name="clock" size={14} color={colors.ink} />
              <Text role="small">{facts.open.now ? "Open" : "Closed"}</Text>
              {facts.open.when ? (
                <Text role="small" numberOfLines={1} style={styles.name} testID="place-hours">{`· ${facts.open.when}`}</Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <CardButton
            icon={saved ? "heart-filled" : "heart"}
            color={colors.ink}
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
      <Icon name={icon} size={14} color={color} />
      <Text role="small">{label}</Text>
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
