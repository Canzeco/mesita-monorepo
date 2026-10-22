import { useId } from "react";

// THE ONE NO-PHOTO FACE (Pato, MESITA-2620: "use same icon for me and
// consumer for anonymous as instagram anonymous"). Me's identity card, the
// profile editor, every Social row without a photo and the place screen's
// social line draw this; a member's real photo replaces it on every one of
// them, identical. It is drawn the way Instagram draws its default: a grey
// disc and a white head-and-shoulders silhouette. Never initials, never a
// lucide person glyph: Instagram shows neither.
//
// Deliberately inline SVG rather than a file in /public or a row in storage:
// it's the no-photo state, so it must render before any network call and can
// never 404. The greys are literal on purpose — this stands in for a
// photograph, so it sits outside the theme tokens the way a photo would;
// both are achromatic (the disc is the consumer's --border grey).
//
// Drawn on a 100x100 viewBox: the disc, a head, and shoulders wide enough to
// run past the disc's edge, clipped back to the circle so they meet it flush
// instead of floating inside it.

const FIELD = "#dbdbdb";
const FIGURE = "#ffffff";

export function DefaultAvatar({ className }: { className?: string }) {
  // useId's separators aren't safe inside a url(#…) reference, hence the strip.
  const clipId = `avatar-field-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="No profile photo"
      data-default-avatar
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="50" cy="50" r="50" fill={FIELD} />
        <circle cx="50" cy="41" r="19.7" fill={FIGURE} />
        <ellipse cx="50" cy="86.5" rx="34.4" ry="19.6" fill={FIGURE} />
      </g>
    </svg>
  );
}
