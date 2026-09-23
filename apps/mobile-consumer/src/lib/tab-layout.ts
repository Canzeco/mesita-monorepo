// Tab-scene clearance helpers — content sits above ConsumerTabBar; do not
// re-add the home-indicator inset (the tab bar already pads it). Use these
// for scroll bottoms / absolute overlays so CTAs never clip on SE or Pro Max.

/** Comfortable ScrollView contentContainer paddingBottom inside tab screens. */
export const TAB_SCROLL_PADDING_BOTTOM = 40;

/**
 * True when the guest opened a nested Me box (`/me/profile`, `/me/diamond/invite`,
 * etc.). Web keeps BottomNav on those routes; mobile hides the tab bar so
 * full-page Me boxes own the frame (same feel as place detail / ticket routes).
 */
export function isMeNestedRoute(segments: readonly string[]): boolean {
  return (
    segments[0] === '(tabs)' &&
    segments[1] === 'me' &&
    segments.length > 2
  );
}
