import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { colors, radius, space } from "@/theme";

/** Overview under the facts: photos, about, hours, families, tags. */
export function Overview({ place, width, photo, onPhoto }: { place: PlaceDetail; width: number; photo: number; onPhoto: (index: number) => void }) {
  const photos = place.photos.length ? place.photos : place.profilePhoto ? [place.profilePhoto] : [];
  return (
    <View style={styles.box}>
      {photos.length ? (
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => {
            const w = e.nativeEvent.layoutMeasurement.width || 1;
            onPhoto(Math.round(e.nativeEvent.contentOffset.x / w));
          }}>
            {photos.map((uri) => <Image key={uri} source={uri} style={[styles.hero, { width }]} contentFit="cover" />)}
          </ScrollView>
          <View style={styles.count}>
            <Text role="caption" tone="onInk">{`${photo + 1} / ${photos.length}`}</Text>
          </View>
        </View>
      ) : <Text role="body" tone="muted">No photos yet</Text>}
      {place.long_description ? <Text role="body">{place.long_description}</Text> : null}
      {place.address ? <Text role="small" tone="muted">{place.address}</Text> : null}
      {place.hours_table.length ? (
        <View style={styles.block}>
          <Text role="strong">Hours</Text>
          {place.hours_table.map((row) => <Text key={row.day} role="small">{`${row.day} · ${row.range}`}</Text>)}
        </View>
      ) : null}
      <Tags place={place} />
    </View>
  );
}

function Tags({ place }: { place: PlaceDetail }) {
  const familyLabels = new Set(place.families.map((row) => row.label.trim().toLowerCase()));
  const tags = place.tags.filter((tag) => !familyLabels.has(tag.label.trim().toLowerCase()));
  if (place.families.length === 0 && tags.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text role="strong">Tags</Text>
      <View style={styles.tags}>
        {place.families.map((row) => (
          <View key={row.key} style={styles.tag}>
            <Text role="caption">{`${row.emoji} ${row.label}`.trim()}</Text>
          </View>
        ))}
        {tags.map((tag) => (
          <View key={tag.slug} style={styles.tag}>
            <Text role="caption">{tag.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  hero: { height: 220, backgroundColor: colors.fill },
  count: { position: "absolute", right: space.md, bottom: space.md, backgroundColor: colors.scrim, borderRadius: radius.control, paddingHorizontal: space.sm, paddingVertical: space.xs },
  block: { gap: space.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: colors.fill, borderRadius: radius.control, paddingHorizontal: space.sm, paddingVertical: space.xs },
});
