import { useId } from "react";

// The anonymous-user avatar every consumer starts with. A brand-new account
// has no photo, and initials read like a placeholder rather than a profile —
// this is the neutral silhouette (Instagram/Google convention) that stands in
// until the member uploads one, so the no-photo state always has something to
// fall back to.
//
// Deliberately inline SVG rather than a file in /public or a row in storage:
// it's the no-photo state, so it must render before any network call and can
// never 404. The greys are literal on purpose — this stands in for a
// photograph, so it sits outside the theme tokens the way a photo would.
//
// Drawn on a 100x100 viewBox: a light field, a head, and shoulders wide enough
// to run past the field's edge, clipped back to the circle so they meet it
// flush instead of floating inside it.

const FIELD = "#f4f6f7";
const FIGURE = "#848894";

export function DefaultAvatar({ className }: { className?: string }) {
  // useId's separators aren't safe inside a url(#…) reference, hence the strip.
  const clipId = `avatar-field-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="No profile photo"
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
