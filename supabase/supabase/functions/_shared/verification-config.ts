// Verification Config: app_config.verification_config (MESITA-1248).
//
// Folds the three loose scalar columns (create_places_as_verified,
// auto_verify_ai_call, auto_verify_ai_email) into one jsonb column, matching
// the shape the console's actions.ts / admin-web-{get,update}-verification-
// config already speak on the wire. auto_verify_video was retired separately
// (dead config, no reader ever obeyed it — see this issue's earlier PR) and
// has no home here.
//
// Defaults preserve the exact semantics the old scalar columns had:
//   createPlacesAsVerified — off by default (a new place needs real proof
//     unless an operator opts in to the Partner badge at create time).
//   autoVerifyAiCall / autoVerifyAiEmail — ON by default (an OTP redemption
//     auto-grants ownership unless an operator opts INTO manual review).
// Getting either polarity backwards is a real security regression, not a
// cosmetic bug — auto-verify grants project_members ownership immediately.

export type VerificationConfig = {
  createPlacesAsVerified: boolean;
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
};

export function normalizeVerificationConfig(raw: unknown): VerificationConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    createPlacesAsVerified: r.createPlacesAsVerified === true,
    autoVerifyAiCall: r.autoVerifyAiCall !== false,
    autoVerifyAiEmail: r.autoVerifyAiEmail !== false,
  };
}
