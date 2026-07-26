// Single source for parked tab / Home-mode "coming soon" flags + copy.
// Mirrors web BottomNav + HomeModeNav (MESITA-383 / MESITA-565). Unpark =
// flip `soon: false` here — TabBar / SegmentNav read this table only.
//
// Memo (Ask AI) is LIVE on web HomeModeNav — do not invent a parked flag.

export const PARKED = {
  tabs: {
    rewards: {
      soon: true,
      title: 'Rewards coming soon',
      body: 'Pay with QR and claim Mesita rewards from here shortly. Hang tight.',
    },
    // Un-parked (MESITA-715): booking is live, so the tab opens the real
    // Upcoming/History screen instead of a coming-soon dialog.
    reservations: {
      soon: false,
      title: 'Reservations coming soon',
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
