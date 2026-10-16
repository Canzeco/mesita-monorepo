import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

export type ChannelStat = {
  key: "google" | "instagram" | "facebook";
  value: string;
  label: string;
  /** Google rating row uses a star beside the value. */
  googleShowStar?: boolean;
};

/** Profile header — only channels that have a number to show. */
export function profileChannelStats(place: PlaceDetail): ChannelStat[] {
  const googleRating = formatRating(place.google.rating);
  const googleCount = place.google.count;
  const stats: ChannelStat[] = [];
  if (googleRating != null) {
    stats.push({
      key: "google",
      value: googleRating,
      label:
        googleCount != null
          ? `${formatCompactCount(googleCount, false)} Google`
          : "Google",
      googleShowStar: true,
    });
  }
  if (place.instagram.followers != null) {
    stats.push({
      key: "instagram",
      value: formatCompactCount(place.instagram.followers, false),
      label: "Instagram",
    });
  }
  if (place.facebook.followers != null) {
    stats.push({
      key: "facebook",
      value: formatCompactCount(place.facebook.followers, false),
      label: "Facebook",
    });
  }
  return stats;
}

/** Reviews tab — always Google · Instagram · Facebook, like Posts · Following · Followers. */
export function reviewsTabChannelStats(place: PlaceDetail): ChannelStat[] {
  const googleCount = place.google.count;
  const googleRating = formatRating(place.google.rating);
  const googleValue =
    googleCount != null
      ? formatCompactCount(googleCount, false)
      : googleRating ?? "—";

  return [
    {
      key: "google",
      value: googleValue,
      label: "Google",
      googleShowStar: googleCount == null && googleRating != null,
    },
    {
      key: "instagram",
      value:
        place.instagram.followers != null
          ? formatCompactCount(place.instagram.followers, false)
          : "—",
      label: "Instagram",
    },
    {
      key: "facebook",
      value:
        place.facebook.followers != null
          ? formatCompactCount(place.facebook.followers, false)
          : "—",
      label: "Facebook",
    },
  ];
}
