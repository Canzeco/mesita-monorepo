// The words every money surface wears while Stripe is in test mode
// (MESITA-3303). They live here, apart from TestBand.tsx, so an app without
// Tailwind or lucide (web-visit's proof page, MESITA-3304) shows the same
// words in its own look. TestBand.tsx re-exports them.

export const TEST_BAND_TEXT = "TEST: no real money moves";
