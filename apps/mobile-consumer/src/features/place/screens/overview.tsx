import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { toAmPm } from "@/generated/shared/lib/place-time";
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
      <Presentation text={place.long_description} />
      {place.address ? <Text role="small" tone="muted">{place.address}</Text> : null}
      {place.hours_table.length ? <Hours place={place} /> : null}
      <Tags place={place} />
    </View>
  );
}

const FOLD_OVER = 400;

function presentationText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const blankSplit = normalized.split(/\n\s*\n+/).map((part) => part.replace(/\n+/g, " ").replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  if (blankSplit.length > 1) return blankSplit.join("\n\n");
  const soft = normalized.split(/\n+/).map((part) => part.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  return soft.length > 1 ? soft.join("\n\n") : normalized;
}

function Presentation({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const body = presentationText(text);
  if (!body) return null;
  const folded = body.length > FOLD_OVER && !open;
  return (
    <View style={styles.block}>
      <Text role="strong">Presentation</Text>
      <View style={styles.hours}>
        <Text role="body">{folded ? `${body.slice(0, FOLD_OVER).trim()}…` : body}</Text>
        {folded ? (
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
            <Text role="label">Show more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function weekdayThere(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  }
}

function Hours({ place }: { place: PlaceDetail }) {
  const today = place.timezone ? weekdayThere(place.timezone) : "";
  const until = place.open_now ? place.closes_at : place.opens_at;
  const word = place.open_now === true ? "Open" : place.open_now === false ? "Closed" : null;
  const now = word && until ? `${word} until ${toAmPm(until)}` : word;
  return (
    <View style={styles.block}>
      <Text role="strong">Hours</Text>
      <View style={styles.hours}>
        {now ? (
          <View style={styles.hour}>
            <Text role="small" tone="muted">Now</Text>
            <Text role="small" tone={place.open_now ? "price" : "closed"}>{now}</Text>
          </View>
        ) : null}
        {place.hours_table.map((row) => {
          const on = row.day === today;
          return (
            <View key={row.day} style={styles.hour}>
              <Text role="small" tone={on ? "ink" : "muted"}>{row.day}</Text>
              <Text role="small" tone={row.range.toLowerCase() === "closed" ? "muted" : "ink"}>{row.range}</Text>
            </View>
          );
        })}
      </View>
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
  hours: { gap: space.xs, padding: space.md, borderRadius: radius.field, backgroundColor: colors.fill },
  hour: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: colors.fill, borderRadius: radius.control, paddingHorizontal: space.sm, paddingVertical: space.xs },
});
