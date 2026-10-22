import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

export type ChannelStat = {
  key: "google" | "instagram" | "facebook";
  name: "Google" | "Instagram" | "Facebook";
  /** Big number, or "-" when there is no number (MESITA-2647). */
  value: string;
  /** Read aloud instead of "-": "not connected", "no count", "no rating". */
  spoken?: string;
  /** Smaller, muted text beside the value on the same line: "(13.8K)". */
  detail?: string;
  label: string;
  /** No stored number. The icon stays; the label says why. */
  mention?: boolean;
};

// ONE MARK FOR "NO NUMBER" (Pato, MESITA-2647: "don't say not connected
// and no count, use same word or no word, just say -"). The cell shows "-";
// a screen reader still hears why.
const NONE = "-";
const NOT_CONNECTED = "not connected";
const NO_COUNT = "no count";

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
    value: NONE,
    spoken: linked ? NO_COUNT : NOT_CONNECTED,
    label: name,
    mention: true,
  };
}

function googleStat(
  place: PlaceDetail,
  value: string | null,
  label: string,
  detail?: string,
): ChannelStat {
  if (value != null) {
    return detail != null
      ? { key: "google", name: "Google", value, detail, label }
      : { key: "google", name: "Google", value, label };
  }
  const linked = Boolean(place.reviews_maps.google_maps_url);
  return {
    key: "google",
    name: "Google",
    value: NONE,
    spoken: linked ? "no rating" : NOT_CONNECTED,
    label: "Google",
    mention: true,
  };
}

/**
 * Profile header — always Google · Instagram · Facebook, the same three
 * slots as an Instagram profile's posts · followers · following.
 * A zero stays "0". No number at all shows "-" (MESITA-2647); the
 * screen reader hears "not connected" or "no count". The icon is drawn
 * either way.
 *
 * Google reads the way Maps does, stars then the review count on one line:
 * "4.9 ★ (13.8K)" (Pato, MESITA-2312). The label under it is just "Google".
 * The count is the smaller, muted detail so the line never wraps (MESITA-2315).
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
          `${googleRating} ★`,
          "Google",
          count != null ? `(${count})` : undefined,
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
