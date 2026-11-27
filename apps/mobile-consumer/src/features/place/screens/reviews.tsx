import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { space } from "@/theme";

/** Stars and the comment. No reviewer name. */
export function Reviews({ place }: { place: PlaceDetail }) {
  if (!place.google_reviews.length) return <Text role="body" tone="muted">No reviews yet</Text>;
  return (
    <View style={styles.box}>
      {place.google_reviews.map((review, i) => (
        <View key={`${review.date}-${i}`} style={styles.block}>
          <Text role="label">{`${review.rating} stars`}</Text>
          <Text role="body">{review.quote}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space.md }, block: { gap: space.xs } });
