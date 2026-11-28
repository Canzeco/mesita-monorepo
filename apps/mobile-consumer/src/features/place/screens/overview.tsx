import { Image } from "expo-image";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { formatDistanceKm } from "@/generated/shared/lib/format";
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
      <Location place={place} />
      {place.hours_table.length ? <Hours place={place} /> : null}
      <PopularTimes place={place} />
      <Tags place={place} />
      <Stats place={place} />
      <Score place={place} />
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

function uberUrl(place: PlaceDetail): string {
  const drop: Record<string, string | number> = {
    addressLine1: place.name.trim() || "Destination",
    addressLine2: place.address.trim(),
  };
  if (typeof place.lat === "number" && Number.isFinite(place.lat) && typeof place.lng === "number" && Number.isFinite(place.lng)) {
    drop.latitude = place.lat;
    drop.longitude = place.lng;
  }
  const params = new URLSearchParams();
  params.set("drop[0]", JSON.stringify(drop));
  return `https://m.uber.com/looking?${params.toString()}`;
}

function Location({ place }: { place: PlaceDetail }) {
  if (!place.address && place.lat == null) return null;
  const maps = place.reviews_maps.google_maps_url ?? (place.address ? `https://maps.google.com/?q=${encodeURIComponent(place.address)}` : "");
  const distance = place.distance_km > 0 ? formatDistanceKm(place.distance_km) : null;
  return (
    <View style={styles.block}>
      <View style={styles.hour}>
        <Text role="strong">Location</Text>
        {distance ? <Text role="caption" tone="muted">{distance}</Text> : null}
      </View>
      {place.address ? <Text role="body">{place.address}</Text> : null}
      <View style={styles.hour}>
        {maps ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${place.name} in Google Maps`} onPress={() => void Linking.openURL(maps)} style={styles.mapBtn}>
            <Text role="label">Google Maps</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(uberUrl(place))} style={styles.mapBtn}>
          <Text role="label">Ask Uber</Text>
        </Pressable>
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

function PopularTimes({ place }: { place: PlaceDetail }) {
  const days = place.popular_times.filter((day) => day.day && day.range);
  let today = "";
  try {
    today = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: place.timezone || undefined }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date());
  }
  const initial = days.find((day) => day.day.trim().slice(0, 3).toLowerCase() === today.slice(0, 3).toLowerCase())?.day ?? days[0]?.day ?? "";
  const [selected, setSelected] = useState(initial);
  if (days.length === 0) return null;
  const featured = days.find((day) => day.day === selected) ?? days[0];
  const bars = featured.bars.filter((value) => Number.isFinite(value));
  return (
    <View style={styles.block}>
      <View style={styles.hour}>
        <Text role="strong">Popular times</Text>
        <Text role="caption" tone="muted">From Google</Text>
      </View>
      <View style={styles.sorts}>
        {days.map((day) => {
          const on = day.day === featured.day;
          return (
            <Pressable key={day.day} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSelected(day.day)} style={[styles.dayChip, on && styles.dayChipOn]}>
              <Text role="caption" tone={on ? "onInk" : "muted"}>{day.day.slice(0, 3)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text role="caption" tone="muted">{`Busiest ${featured.range}`}</Text>
      {bars.length > 0 ? (
        <View style={styles.bars}>
          {bars.map((value, index) => (
            <View key={index} style={[styles.bar, { height: Math.max(Math.min(value, 1), 0.06) * 72 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function scoreNumber(value: number | null | undefined, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function Stats({ place }: { place: PlaceDetail }) {
  const stats = place.profile_stats;
  if (!stats) return null;
  const cells = [
    { key: "viewed", label: "Mesita Views", n: stats.viewed },
    { key: "saved", label: "Mesita Likes", n: stats.saved },
  ];
  return (
    <View style={styles.block}>
      <Text role="strong">Stats</Text>
      <View style={styles.hour}>
        {cells.map((cell) => (
          <View key={cell.key} style={styles.stat}>
            <Text role="caption" tone="muted">{cell.label}</Text>
            <Text role="title">{cell.n.toLocaleString("en-US")}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Score({ place }: { place: PlaceDetail }) {
  const score = place.score;
  if (!score) return null;
  const rows = [
    { key: "proximity", label: "Proximity", value: scoreNumber(score.proximity) },
    { key: "popularity", label: "Popularity", value: scoreNumber(score.popularity) },
    { key: "premier", label: "Premier", value: `×${scoreNumber(score.premier, 0)}` },
    { key: "final", label: "Final", value: scoreNumber(score.final), strong: true },
  ];
  return (
    <View style={styles.block}>
      <Text role="strong">Score</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.hour}>
          <Text role="small" tone={row.strong ? "ink" : "muted"}>{row.label}</Text>
          <Text role="small">{row.value}</Text>
        </View>
      ))}
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
  count: { position: "absolute", right: space.md, bottom: space.md, backgroundColor: colors.scrim, borderRadius: radius.lg, paddingHorizontal: space.sm, paddingVertical: space.xs },
  block: { gap: space.xs },
  hours: { gap: space.xs, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.fill },
  hour: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  mapBtn: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.xl, backgroundColor: colors.fill },
  sorts: { flexDirection: "row", gap: 4 },
  dayChip: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.fill },
  dayChipOn: { backgroundColor: colors.ink },
  stat: { flex: 1, gap: 4, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.fill },
  bars: { height: 72, flexDirection: "row", alignItems: "flex-end", gap: 4 },
  bar: { flex: 1, borderRadius: 99, backgroundColor: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: colors.fill, borderRadius: radius.lg, paddingHorizontal: space.sm, paddingVertical: space.xs },
});
