import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { colors, radius, space } from "@/theme";

const PAGE = 5;
const LONG = 220;
type Sort = "newest" | "best" | "worst";
const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "best", label: "Best" },
  { key: "worst", label: "Worst" },
];

function when(raw: string, now: number): string {
  const at = Date.parse(raw);
  if (!raw || !Number.isFinite(at)) return raw;
  const diff = now - at;
  if (diff < 0) return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const day = 86_400_000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (diff < 30 * day) {
    const n = Math.floor(diff / (7 * day));
    return `${n} week${n === 1 ? "" : "s"} ago`;
  }
  if (diff < 365 * day) {
    const n = Math.floor(diff / (30 * day));
    return `${n} month${n === 1 ? "" : "s"} ago`;
  }
  const n = Math.floor(diff / (365 * day));
  return `${n} year${n === 1 ? "" : "s"} ago`;
}

function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`;
}

/** Google's reviews: stars, when, and the comment. No names. */
export function Reviews({ place }: { place: PlaceDetail }) {
  const [now] = useState(() => Date.now());
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<Sort>("newest");
  const reviews = place.google_reviews;
  const sorted = useMemo(
    () =>
      [...reviews].sort((a, b) => {
        if (sort === "best" && a.rating !== b.rating) return b.rating - a.rating;
        if (sort === "worst" && a.rating !== b.rating) return a.rating - b.rating;
        return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
      }),
    [reviews, sort],
  );
  const url = place.reviews_maps.google_review_url;
  if (reviews.length === 0) {
    return (
      <View style={styles.box}>
        <Text role="body">No reviews yet</Text>
        <Text role="caption" tone="muted">Reviews of this place will show up here.</Text>
        {url ? <Leave url={url} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text role="caption" tone="muted" style={styles.privacy}>Names hidden for privacy</Text>
        {sorted.length > 1 ? (
          <View style={styles.sorts}>
            {SORTS.map((option) => (
              <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: sort === option.key }} onPress={() => { setSort(option.key); setShown(PAGE); }}>
                <Text role="caption" tone={sort === option.key ? "ink" : "muted"}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        {sorted.slice(0, shown).map((review, index) => (
          <Quote key={`${review.date}-${index}`} rating={review.rating} date={when(review.date, now)} text={review.quote} />
        ))}
        {shown < sorted.length ? (
          <Pressable accessibilityRole="button" onPress={() => setShown((n) => n + PAGE)} style={styles.more}>
            <Text role="label">Show more</Text>
          </Pressable>
        ) : null}
      </View>
      {url ? <Leave url={url} /> : null}
    </View>
  );
}

function Quote({ rating, date, text }: { rating: number; date: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG;
  return (
    <View style={styles.review}>
      <Text role="label">{`${stars(rating)}  ${date}`}</Text>
      <Text role="body">{long && !open ? `${text.slice(0, LONG).trim()}…` : text}</Text>
      {long && !open ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
          <Text role="label">Read more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Leave({ url }: { url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.leave}>
      <Text role="label">Leave a review on Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  privacy: { flex: 1 },
  sorts: { flexDirection: "row", gap: space.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius["2xl"], backgroundColor: colors.paper, overflow: "hidden" },
  review: { gap: space.xs, padding: space.lg, borderBottomWidth: 1, borderColor: colors.border },
  more: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  leave: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius["2xl"], backgroundColor: colors.paper },
});
