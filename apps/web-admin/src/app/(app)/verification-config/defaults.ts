// Verification config shape + defaults. Deliberately NOT in actions.ts: that
// file is "use server", and a Server Actions module may export only async
// functions — a const export there fails Next's page-data collection at build
// time. Mirrors supabase/functions/_shared/verification-config.ts, which is
// authoritative.

export type VerificationConfig = {
  createPlacesAsVerified: boolean;
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
};

export const VERIFICATION_FALLBACK: VerificationConfig = {
  createPlacesAsVerified: false,
  autoVerifyAiCall: true,
  autoVerifyAiEmail: true,
};

export function normalizeVerificationConfig(raw: unknown): VerificationConfig {
  const bag = (raw !== null && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof VerificationConfig, unknown>
  >;
  return {
    createPlacesAsVerified: bag.createPlacesAsVerified === true,
    autoVerifyAiCall: bag.autoVerifyAiCall !== false,
    autoVerifyAiEmail: bag.autoVerifyAiEmail !== false,
  };
}
