// Single source for parked tab / Home-mode "coming soon" flags + copy.
// Mirrors web BottomNav + HomeModeNav (MESITA-383 / MESITA-565). Unpark =
// flip `soon: false` here — TabBar / SegmentNav read this table only.
//
// Memo (Ask AI) is parked on web HomeModeNav too (`soon: true` → ComingSoon
// dialog). Mobile parks Memo in `home.tsx` SegmentNav the same way; Social
// is the homeMode row in this table.

export const PARKED = {
  tabs: {
    // Un-parked: the pass + ticket stack are live, and web unparked in the
    // same change (the parked-vs-live parity rule).
    rewards: {
      soon: false,
      title: 'Rewards coming soon',
      body: 'Pay with QR and claim Mesita rewards from here shortly. Hang tight.',
    },
    // Un-parked (MESITA-715): booking is live, so the tab opens the real
    // Upcoming/History screen instead of a coming-soon dialog.
    inbox: {
      soon: false,
      // Dormant copy (soon: false), but it names the SECTION, so it follows the
      // tab label: "Activity", not "Reservations".
      title: 'Inbox coming soon',
      body: 'Your bookings will live here. For now, reach places from Contact on a place.',
    },
  },
  homeModes: {
    social: {
      // Flip to false to unpark — Home SegmentNav + keep-alive SocialTab
      // show the feed; no other file changes required (MESITA-693 #36).
      soon: true,
      // Web ComingSoon dialog title = the mode label ("Social").
      title: 'Social',
      body: 'See where your friends are going and share the places you love. Landing here soon.',
    },
  },
} as const;

export type ParkedTabKey = keyof typeof PARKED.tabs;

export function isTabParked(key: string): key is ParkedTabKey {
  return key in PARKED.tabs && PARKED.tabs[key as ParkedTabKey].soon;
}
