// Tab-scene clearance helpers — content sits above ConsumerTabBar; do not
// re-add the home-indicator inset (the tab bar already pads it). Use these
// for scroll bottoms / absolute overlays so CTAs never clip on SE or Pro Max.

/** Extra gap between scene content and the top edge of the tab bar. */
export const TAB_SCENE_BOTTOM_GAP = 16;

/** Comfortable ScrollView contentContainer paddingBottom inside tab screens. */
export const TAB_SCROLL_PADDING_BOTTOM = 40;

/** Absolute overlays (Search rail/chip) sit this many px above scene bottom. */
export const TAB_OVERLAY_BOTTOM = 8;
