// The placePaymentAccounts aggregate — the Stripe Connect mirror for a place
// (PLATFORM posture: see stripe-connect.ts for the law). One row per place
// (gate 2026-08-29: 1:1, `stripe_account_id` unique; relaxing to shared
// accounts later means dropping the unique — the reversible direction).
//
// Validators ARE the law and this is the ONE write door (document-model
// convention, same two-belt shape as place-doc.ts): every field in
// PaymentAccountRow is either patchable through PAYMENT_ACCOUNT_PATCH_KEYS
// or named in the Omit below, and the exhaustiveness assert breaks the build
// when the row grows a field this file forgot.
//
// Readers derive, never re-derive: charge readiness is isConnectChargeReady
// below. The full pay-readiness chain is
//   places.mesita_pay_enabled (operator intent bit)
//   ∧ visits_config.payCard   (global rail switch)
//   ∧ isConnectChargeReady    (Stripe-derived capability, THIS module)
// — the composition the intent-bit column comments promise. Payouts are
// deliberately NOT part of charge readiness.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PaymentAccountRow = {
  place_id: string;
  created_at: string;
  updated_at: string;
  /** "acct_…" (real) or "mock_acct_<place_id>" (mock). Unique. */
  stripe_account_id: string;
  /** Which Stripe universe created it — from the key prefix or event.livemode,
   *  NEVER from the Account object (no such field on stripe@17). */
  livemode: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  /** Snapshot of requirements.currently_due (strings; [] when clear). */
  requirements_due: string[];
  /** requirements.disabled_reason; null = not disabled. */
  disabled_reason: string | null;
  /** ISO-3166-1 alpha-2, as STRIPE reports it on the Account — not as we
   *  requested it. Per-account permanent, so this is the field that decides
   *  whether a later onboarding request is a mismatch (stripe-connect.ts
   *  classifyExistingAccount). Null only on rows written before MESITA-1532. */
  country: string | null;
};

export const PAYMENT_ACCOUNT_PATCH_KEYS = [
  "stripe_account_id",
  "livemode",
  "charges_enabled",
  "details_submitted",
  "payouts_enabled",
  "requirements_due",
  "disabled_reason",
  "country",
] as const satisfies readonly (keyof Omit<
  PaymentAccountRow,
  "place_id" | "created_at" | "updated_at"
>)[];

type _MissingFromPaymentAccountPatchKeys = Exclude<
  keyof Omit<PaymentAccountRow, "place_id" | "created_at" | "updated_at">,
  typeof PAYMENT_ACCOUNT_PATCH_KEYS[number]
>;
const _assertNoMissingPaymentAccountKeys:
  _MissingFromPaymentAccountPatchKeys extends never ? true
    : ["PAYMENT_ACCOUNT_PATCH_KEYS is missing a field", _MissingFromPaymentAccountPatchKeys] =
      true;
void _assertNoMissingPaymentAccountKeys;

export type PaymentAccountPatch = Partial<
  Pick<PaymentAccountRow, typeof PAYMENT_ACCOUNT_PATCH_KEYS[number]>
>;

const BOOLEAN_KEYS = new Set<string>([
  "livemode",
  "charges_enabled",
  "details_submitted",
  "payouts_enabled",
]);

function checkField(key: string, v: unknown): string | null {
  if (BOOLEAN_KEYS.has(key)) {
    return typeof v === "boolean" ? null : `${key} must be a boolean`;
  }
  switch (key) {
    case "stripe_account_id":
      return typeof v === "string" && v.trim().length > 0
        ? null
        : "stripe_account_id must be a non-empty string";
    case "country":
      // Null is legal (pre-MESITA-1532 rows, and accounts Stripe answers
      // without a country); a non-ISO string never is.
      return v === null || (typeof v === "string" && /^[A-Z]{2}$/.test(v))
        ? null
        : "country must be a 2-letter ISO country code or null";
    case "requirements_due":
      return Array.isArray(v) && v.every((x) => typeof x === "string")
        ? null
        : "requirements_due must be an array of strings";
    case "disabled_reason":
      return v === null || typeof v === "string"
        ? null
        : "disabled_reason must be a string or null";
    default:
      return `unknown payment account field: ${key}`;
  }
}

export type PaymentAccountPatchValidation =
  | { ok: true; patch: PaymentAccountPatch }
  | { ok: false; error: string };

export function validatePaymentAccountPatch(
  input: unknown,
): PaymentAccountPatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "payment account patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!(PAYMENT_ACCOUNT_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown payment account field: ${key}` };
    }
    const err = checkField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = raw[key];
  }
  return { ok: true, patch: patch as PaymentAccountPatch };
}

export type PaymentAccountWriteArgs =
  | {
    mode: "insert";
    placeId: string;
    /** Full initial state; stripe_account_id required. */
    row: PaymentAccountPatch & { stripe_account_id: string };
  }
  | {
    mode: "update";
    /** The webhook keys by stripe_account_id; EFs key by place_id. */
    by: "place_id" | "stripe_account_id";
    id: string;
    patch: PaymentAccountPatch;
  };

export type PaymentAccountWriteResult =
  | {
    ok: true;
    /** null on a zero-row update — a DETECTED no-op (e.g. account.updated
     *  for an account that isn't ours / another universe), never a silent
     *  PostgREST success. */
    row: PaymentAccountRow | null;
  }
  | { ok: false; error: string };

export async function writePaymentAccount(
  admin: SupabaseClient,
  args: PaymentAccountWriteArgs,
): Promise<PaymentAccountWriteResult> {
  if (args.mode === "insert") {
    const validated = validatePaymentAccountPatch(args.row);
    if (!validated.ok) return validated;
    const { data, error } = await admin
      .from("place_payment_accounts")
      .insert({ place_id: args.placeId, ...validated.patch })
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: (data as PaymentAccountRow | null) ?? null };
  }
  const validated = validatePaymentAccountPatch(args.patch);
  if (!validated.ok) return validated;
  // updated_at is also stamped by the table trigger; setting it here keeps
  // the mirror honest even if a future environment lacks the trigger.
  const { data, error } = await admin
    .from("place_payment_accounts")
    .update({ ...validated.patch, updated_at: new Date().toISOString() })
    .eq(args.by, args.id)
    .select()
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data as PaymentAccountRow | null) ?? null };
}

/** Charge-ready = can take a direct charge. Payouts deliberately excluded. */
export function isConnectChargeReady(
  row: Pick<PaymentAccountRow, "charges_enabled" | "details_submitted"> | null,
): boolean {
  return row !== null && row.charges_enabled === true &&
    row.details_submitted === true;
}
