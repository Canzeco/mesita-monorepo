// Visits config shape + defaults. Deliberately NOT in actions.ts: that file is
// "use server", and a Server Actions module may export only async functions —
// a const export there fails Next's page-data collection at build time.
// Mirrors supabase/functions/_shared/visits-config.ts, which is authoritative.

export type VisitsConfig = {
  tipEnabled: boolean;
  tipPresets: number[];
  defaultTipPct: number;
  consumerPollSeconds: number;
  staffPollSeconds: number;
  staffPollMaxSeconds: number;
  requireProofScreenshot: boolean;
  maxFixRequests: number;
  payCash: boolean;
  payCard: boolean;
  payCredits: boolean;
  autoCloseHours: number;
  legacyV3Enabled: boolean;
  reportEnabled: boolean;
};

export const VISITS_FALLBACK: VisitsConfig = {
  tipEnabled: true,
  tipPresets: [10, 15, 20],
  defaultTipPct: 15,
  consumerPollSeconds: 10,
  staffPollSeconds: 3,
  staffPollMaxSeconds: 30,
  requireProofScreenshot: true,
  maxFixRequests: 2,
  payCash: true,
  payCard: false,
  payCredits: false,
  autoCloseHours: 12,
  legacyV3Enabled: true,
  reportEnabled: true,
};
