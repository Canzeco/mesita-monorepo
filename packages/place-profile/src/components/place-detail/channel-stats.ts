import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

export type ChannelStat = {
  key: "google" | "instagram" | "facebook";
  name: "Google" | "Instagram" | "Facebook";
  /** Big number. Empty when the cell is a mention instead of a count. */
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
  return {
    key,
    name,
    value: "",
    label: linked ? NO_COUNT : NOT_CONNECTED,
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
    value: "",
    label: linked ? "No rating" : NOT_CONNECTED,
    mention: true,
  };
}

/**
 * Profile header — always Google · Instagram · Facebook, the same three
 * slots as an Instagram profile's posts · followers · following.
 * A zero stays "0". No link says "Not connected". A link with no number
 * says "No count". The icon is drawn either way.
 */
export function profileChannelStats(place: PlaceDetail): ChannelStat[] {
  const googleRating = formatRating(place.google.rating);
  const googleCount = place.google.count;
  const google =
    googleRating != null
      ? googleStat(
          place,
          googleRating,
          googleCount != null
            ? `${formatCompactCount(googleCount, false)} Google`
            : "Google",
        )
      : googleStat(
          place,
          googleCount != null ? formatCompactCount(googleCount, false) : null,
          "Google",
        );

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

/** Reviews tab — same three channels, Google's number is the review count. */
export function reviewsTabChannelStats(place: PlaceDetail): ChannelStat[] {
  const googleCount = place.google.count;
  const googleRating = formatRating(place.google.rating);
  const google =
    googleCount != null
      ? googleStat(place, formatCompactCount(googleCount, false), "Google")
      : googleStat(place, googleRating, "Google");

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
