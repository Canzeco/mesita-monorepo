// Tab-scene clearance helpers — content sits above ConsumerTabBar; do not
// re-add the home-indicator inset (the tab bar already pads it). Use these
// for scroll bottoms / absolute overlays so CTAs never clip on SE or Pro Max.

/** Comfortable ScrollView contentContainer paddingBottom inside tab screens. */
export const TAB_SCROLL_PADDING_BOTTOM = 40;
