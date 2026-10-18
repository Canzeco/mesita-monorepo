import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

export type ChannelStat = {
  key: "google" | "instagram" | "facebook";
  name: "Google" | "Instagram" | "Facebook";
  /** Big number, or "Not connected" / "No count" when there is no number. */
  value: string;
  label: string;
  /** No stored number. The icon stays; the label says why. */
  mention?: boolean;
};

const NOT_CONNECTED = "Not connected";
const NO_COUNT = "No count";

function reachStat(
  key: "instagram" | "facebook",
  name: "Instagram" | "Facebook",
  followers: number | null,
  linked: boolean,
): ChannelStat {
  if (followers != null) {
    return {
      key,
      name,
      value: formatCompactCount(followers, false),
      label: name,
    };
  }
  // The number slot stays filled. An empty string reads as a blank column.
  return {
    key,
    name,
    value: linked ? NO_COUNT : NOT_CONNECTED,
    label: name,
    mention: true,
  };
}

function googleStat(
  place: PlaceDetail,
  value: string | null,
  label: string,
): ChannelStat {
  if (value != null) {
    return { key: "google", name: "Google", value, label };
  }
  const linked = Boolean(place.reviews_maps.google_maps_url);
  return {
    key: "google",
    name: "Google",
    value: linked ? "No rating" : NOT_CONNECTED,
    label: "Google",
    mention: true,
  };
}

/**
 * Profile header — always Google · Instagram · Facebook, the same three
 * slots as an Instagram profile's posts · followers · following.
 * A zero stays "0". No link says "Not connected". A link with no number
 * says "No count". The icon is drawn either way.
 *
 * Google reads the way Maps does, stars then the review count on one line:
 * "4.9 ★ (13.8K)" (Pato, MESITA-2312). The label under it is just "Google".
 */
export function profileChannelStats(place: PlaceDetail): ChannelStat[] {
  const googleRating = formatRating(place.google.rating);
  const googleCount = place.google.count;
  const count =
    googleCount != null ? formatCompactCount(googleCount, false) : null;
  const google =
    googleRating != null
      ? googleStat(
          place,
          count != null ? `${googleRating} ★ (${count})` : `${googleRating} ★`,
          "Google",
        )
      : googleStat(place, count != null ? `(${count})` : null, "Google");

  return [
    google,
    reachStat(
      "instagram",
      "Instagram",
      place.instagram.followers,
      Boolean(place.channels.instagram_url),
    ),
    reachStat(
      "facebook",
      "Facebook",
      place.facebook.followers,
      Boolean(place.channels.facebook_url),
    ),
  ];
}
