// Ojo config shape + defaults. Deliberately NOT in actions.ts: that file is
// "use server", and a Server Actions module may export only async functions —
// a const export there fails Next's page-data collection at build time.
// Mirrors supabase/functions/_shared/ojo-config.ts, which is authoritative.

export type OjoChecks = {
  placeNameMatches: boolean;
  isRightSurface: boolean;
  ratingPresent: boolean;
  recentTimestamp: boolean;
};

export type OjoConfig = {
  enabled: boolean;
  autoPassScore: number;
  reviewFloorScore: number;
  failAction: "flag" | "withhold";
  showGuestReason: boolean;
  maxRetries: number;
  checks: OjoChecks;
  prompt: string;
};

export const OJO_FALLBACK: OjoConfig = {
  enabled: false,
  autoPassScore: 0.75,
  reviewFloorScore: 0.45,
  failAction: "flag",
  showGuestReason: true,
  maxRetries: 3,
  checks: {
    placeNameMatches: true,
    isRightSurface: true,
    ratingPresent: true,
    recentTimestamp: false,
  },
  prompt: "",
};
