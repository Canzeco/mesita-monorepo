import { useId } from 'react';
import Svg, { ClipPath, Circle, Defs, Ellipse, G } from 'react-native-svg';

// The anonymous-user avatar every consumer starts with — RN port of web
// `components/consumer/DefaultAvatar.tsx`; keep the two in sync. A brand-new
// account has no photo, and initials read like a placeholder rather than a
// profile, so this neutral silhouette (Instagram/Google convention) stands in
// until the member uploads one.
//
// Deliberately drawn in code rather than shipped as a bundled PNG or a row in
// storage: it's the no-photo state, so it must render before any network call
// and can never 404. The greys are literal on purpose — this stands in for a
// photograph, so it sits outside the theme tokens the way a photo would.
//
// Drawn on a 100x100 viewBox: a light field, a head, and shoulders wide enough
// to run past the field's edge, clipped back to the circle so they meet it
// flush instead of floating inside it.

const FIELD = '#f4f6f7';
const FIGURE = '#848894';

export function DefaultAvatar({ size }: { size: number }) {
  // react-native-svg resolves clip paths by id across the whole tree, so the
  // hero and the editor sheet can't share a hardcoded one. useId's separators
  // aren't safe inside a url(#…) reference, hence the strip.
  const clipId = `avatar-field-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx="50" cy="50" r="50" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx="50" cy="50" r="50" fill={FIELD} />
        <Circle cx="50" cy="41" r="19.7" fill={FIGURE} />
        <Ellipse cx="50" cy="86.5" rx="34.4" ry="19.6" fill={FIGURE} />
      </G>
    </Svg>
  );
}
