// The consumer aggregate — validator + THE write door (MESITA-1247, "Mesita
// as documents" §C, item 1 of 6). Picked as the FIRST aggregate to route
// because its write surface is the smallest and most bounded of the six:
// 7 call sites across 6 Edge Functions + 1 shared helper (class-doors.ts),
// against reservation_tickets (10+ files, one with 15+ update sites) and
// visit_tickets (17 files) — see the MESITA-1247 report for the full count
// per aggregate. place/projects/profiles is bigger still (16 files, 29 write
// sites); config and vocab are explicitly out of scope for this issue.
//
// THE TWO-BELT PATTERN (StampablePulseStep, pulse-report.ts):
//   Belt 1 — TypeScript. ConsumerWriteArgs.patch IS ConsumerPatch (a closed
//     key set), not Record<string, unknown> — a misspelled or retired field
//     name fails to compile at every call site that builds the patch as a
//     typed literal or variable. This belt only holds until a caller casts
//     past it (e.g. `as ConsumerPatch` on raw HTTP JSON) — which is exactly
//     what belt 2 exists for.
//   Belt 2 — runtime. validateConsumerPatch re-checks the same closed key
//     set (HTTP JSON has no compiler) plus the shape and cross-field
//     invariants below. A malformed patch never reaches Postgres — it just
//     doesn't write, the same rule pulse-report.ts enforces for a piece a
//     run didn't buy.
//
// THE INVARIANTS, and why each is real (not invented):
//   - code, if set, is "0000-0000" — the exact DB CHECK
//     (consumers_code_format_check, 20260602130000).
//   - sex, if set, is 'male' | 'female' — the DB CHECK matches.
//   - instagram_handle, if set, matches ^[a-z0-9._]{1,30}$ — the exact DB
//     CHECK (20260705090000).
//   - instagram_followers_count, if set, is a non-negative integer — the
//     exact DB CHECK (0034_consumer_membership, "consumer_instagram_
//     followers_count >= 0").
//   - class_origin, if set, is one of default/instagram/invitation —
//     subscription is a PLAN, never a class origin.
//   - plan, if set, is 'free' | 'premium'. Independent of class_key.
//   - class_key / invitation_class_key, if set, are metals (bronze/silver/
//     gold/diamond) — FK to public.classes.
//   - class_expires_at, if set, must be null. The slot no longer expires
//     with a Stripe period; plan does.
//   - invitation_class_key and invitation_granted_at are set or cleared
//     TOGETHER — both call sites that touch them (admin-web-grant-class,
//     consumer-web-claim-invite-code) always write both in the same patch;
//     nothing has ever needed to move one without the other.
//   - deleted_at, if set, is a timestamp string or null — MESITA-1250:
//     deletion is a status. Only `_shared/delete-history-free.ts` writes it.
//
// birthday format, avatar_url's bucket/path shape, and the age gate are
// deliberately NOT here — they are HTTP-input business rules that need
// context this validator doesn't have (today's date, the caller's userId),
// and consumer-web-update-profile/update-profile-fields.ts already owns
// them. This validator checks the STORED SHAPE only.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ── ConsumerDoc — the full row shape ────────────────────────────────────────

export type ConsumerDoc = {
  id: string;
  code: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  sex: "male" | "female" | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  instagram_followers_count: number | null;
  privacy_public: boolean;
  privacy_show_saves: boolean;
  privacy_show_visits: boolean;
  privacy_show_stories: boolean;
  class_key: string;
  class_origin: "default" | "instagram" | "invitation";
  class_expires_at: string | null;
  class_granted_at: string | null;
  invitation_class_key: string | null;
  invitation_granted_at: string | null;
  plan: "free" | "premium";
  /** Stripe customer anchor for the Cards wallet + subscription checkout.
   *  An opaque pointer: card data itself lives in Stripe and is never
   *  mirrored here. Resolved only through _shared/stripe-billing.ts
   *  ensureConsumerCustomer(). */
  stripe_customer_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

// Every field a patch may touch — everything except `id` (identity, set only
// via the insert path below) and `created_at` (server-stamped, never
// patched). `as const satisfies` makes a typo here a compile error.
export const CONSUMER_PATCH_KEYS = [
  "code",
  "first_name",
  "last_name",
  "full_name",
  "sex",
  "birthday",
  "country",
  "phone",
  "avatar_url",
  "instagram_handle",
  "instagram_followers_count",
  "privacy_public",
  "privacy_show_saves",
  "privacy_show_visits",
  "privacy_show_stories",
  "class_key",
  "class_origin",
  "class_expires_at",
  "class_granted_at",
  "invitation_class_key",
  "invitation_granted_at",
  "plan",
  "stripe_customer_id",
  "deleted_at",
] as const satisfies readonly (keyof Omit<ConsumerDoc, "id" | "created_at">)[];

// Compile-time exhaustiveness check the other direction: if a field is ever
// added to ConsumerDoc and this array is forgotten, `_exhaustive` fails to
// type as `true` and the file stops compiling — the same discipline
// FUNCTION_STATE_KEYS borrows from PULSE_PIECE_META (MESITA-1222).
type _MissingFromPatchKeys = Exclude<
  keyof Omit<ConsumerDoc, "id" | "created_at">,
  typeof CONSUMER_PATCH_KEYS[number]
>;
const _assertNoMissingPatchKeys: _MissingFromPatchKeys extends never ? true
  : [
    "CONSUMER_PATCH_KEYS is missing a field from ConsumerDoc",
    _MissingFromPatchKeys,
  ] = true;
void _assertNoMissingPatchKeys;

export type ConsumerPatch = Partial<
  Pick<ConsumerDoc, typeof CONSUMER_PATCH_KEYS[number]>
>;

// ── validateConsumerPatch — belt 2 ─────────────────────────────────────────

export type ConsumerValidationResult =
  | { ok: true; patch: ConsumerPatch }
  | { ok: false; error: string };

const SEX_VALUES = new Set(["male", "female"]);
const CLASS_ORIGIN_VALUES = new Set([
  "default",
  "instagram",
  "invitation",
]);
const PLAN_VALUES = new Set(["free", "premium"]);
// consumers.class_key IS a closed set — FK-enforced by Postgres against
// public.classes. Live rows are the four metals. identityForClassKey still
// maps leftover legacy keys on the way INTO pricing; this validator only
// accepts what Postgres will store.
const CLASS_KEY_VALUES = new Set([
  "bronze",
  "silver",
  "gold",
  "diamond",
]);
const CODE_RE = /^[0-9]{4}-[0-9]{4}$/;
const INSTAGRAM_HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const STRIPE_CUSTOMER_RE = /^(mock_)?cus_[A-Za-z0-9]+$/;

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * The consumer aggregate's runtime shape guard. Rejects an unknown key
 * (closed key set), a wrong-typed value, or a value that breaks one of the
 * cross-field invariants documented above. Returns the same patch back,
 * narrowed to ConsumerPatch, so a caller that passed validation never
 * re-checks what this function already confirmed.
 */
export function validateConsumerPatch(
  input: unknown,
): ConsumerValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "consumer patch must be an object" };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!(CONSUMER_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown consumer field: ${key}` };
    }
  }

  const patch: ConsumerPatch = {};

  if ("code" in raw) {
    const v = raw.code;
    if (v !== null && (typeof v !== "string" || !CODE_RE.test(v))) {
      return { ok: false, error: "code must be 0000-0000 format" };
    }
    patch.code = v as string | null;
  }
  for (
    const key of [
      "first_name",
      "last_name",
      "full_name",
      "country",
      "phone",
      "avatar_url",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isNullableString(v)) {
      return { ok: false, error: `${key} must be a string or null` };
    }
    patch[key] = v;
  }
  if ("sex" in raw) {
    const v = raw.sex;
    if (v !== null && (typeof v !== "string" || !SEX_VALUES.has(v))) {
      return { ok: false, error: "sex must be 'male', 'female', or null" };
    }
    patch.sex = v as "male" | "female" | null;
  }
  if ("birthday" in raw) {
    const v = raw.birthday;
    if (
      v !== null && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    ) {
      return { ok: false, error: "birthday must be YYYY-MM-DD or null" };
    }
    patch.birthday = v as string | null;
  }
  if ("stripe_customer_id" in raw) {
    const v = raw.stripe_customer_id;
    // `cus_…` real, `mock_cus_…` the MOCK_SUBSCRIPTION placeholder. Anything
    // else is a bug upstream, and a malformed id here would 400 at Stripe
    // much later, far from the write that caused it.
    if (v !== null && (typeof v !== "string" || !STRIPE_CUSTOMER_RE.test(v))) {
      return {
        ok: false,
        error: "stripe_customer_id must be a Stripe customer id or null",
      };
    }
    patch.stripe_customer_id = v as string | null;
  }
  if ("instagram_handle" in raw) {
    const v = raw.instagram_handle;
    if (v !== null && (typeof v !== "string" || !INSTAGRAM_HANDLE_RE.test(v))) {
      return {
        ok: false,
        error: "instagram_handle must match ^[a-z0-9._]{1,30}$ or be null",
      };
    }
    patch.instagram_handle = v as string | null;
  }
  if ("instagram_followers_count" in raw) {
    const v = raw.instagram_followers_count;
    if (
      v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0)
    ) {
      return {
        ok: false,
        error:
          "instagram_followers_count must be a non-negative integer or null",
      };
    }
    patch.instagram_followers_count = v as number | null;
  }
  for (
    const key of [
      "privacy_public",
      "privacy_show_saves",
      "privacy_show_visits",
      "privacy_show_stories",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isBoolean(v)) return { ok: false, error: `${key} must be a boolean` };
    patch[key] = v;
  }
  if ("class_key" in raw) {
    const v = raw.class_key;
    if (typeof v !== "string" || !CLASS_KEY_VALUES.has(v)) {
      return {
        ok: false,
        error: `class_key must be one of ${[...CLASS_KEY_VALUES].join(", ")}`,
      };
    }
    patch.class_key = v;
  }
  if ("class_origin" in raw) {
    const v = raw.class_origin;
    if (typeof v !== "string" || !CLASS_ORIGIN_VALUES.has(v)) {
      return {
        ok: false,
        error: "class_origin must be one of default, instagram, invitation",
      };
    }
    patch.class_origin = v as ConsumerDoc["class_origin"];
  }
  if ("plan" in raw) {
    const v = raw.plan;
    if (typeof v !== "string" || !PLAN_VALUES.has(v)) {
      return { ok: false, error: "plan must be 'free' or 'premium'" };
    }
    patch.plan = v as ConsumerDoc["plan"];
  }
  for (
    const key of [
      "class_expires_at",
      "class_granted_at",
      "invitation_granted_at",
      "deleted_at",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isNullableString(v)) {
      return {
        ok: false,
        error: `${key} must be an ISO timestamp string or null`,
      };
    }
    patch[key] = v;
  }
  if ("invitation_class_key" in raw) {
    const v = raw.invitation_class_key;
    // Same FK target as class_key (consumers_invitation_class_key_fkey ->
    // classes(key)) — closed set here too, not just non-null-vs-null.
    if (v !== null && (typeof v !== "string" || !CLASS_KEY_VALUES.has(v))) {
      return {
        ok: false,
        error: `invitation_class_key must be null or one of ${
          [...CLASS_KEY_VALUES].join(", ")
        }`,
      };
    }
    patch.invitation_class_key = v;
  }

  // ── Cross-field invariants ────────────────────────────────────────────
  if (patch.class_expires_at !== undefined && patch.class_expires_at !== null) {
    return {
      ok: false,
      error:
        "class_expires_at must be null (plan, not class, is what a subscription opens)",
    };
  }
  if (
    patch.invitation_class_key !== undefined &&
    patch.invitation_granted_at !== undefined
  ) {
    const bothNull = patch.invitation_class_key === null &&
      patch.invitation_granted_at === null;
    const bothSet = patch.invitation_class_key !== null &&
      patch.invitation_granted_at !== null;
    if (!bothNull && !bothSet) {
      return {
        ok: false,
        error:
          "invitation_class_key and invitation_granted_at must be set or cleared together",
      };
    }
  }

  return { ok: true, patch };
}

// ── writeConsumer — THE write door ─────────────────────────────────────────

export type ConsumerWriteResult =
  | { ok: true; row: Record<string, unknown> | null }
  | { ok: false; error: string; code?: string };

export type ConsumerWriteArgs =
  | { mode: "insert"; id: string; patch: ConsumerPatch; select?: string }
  | { mode: "update"; id: string; patch: ConsumerPatch; select?: string };

/**
 * THE consumer write door. Every insert/update against public.consumers in
 * the codebase goes through this — it is the only place a patch is checked
 * against the aggregate's shape, closed key set, and cross-field invariants
 * before Postgres ever sees it. `select`, when given, re-reads exactly those
 * columns after the write (matching what each call site already needed);
 * omitted, the write is fire-and-check-error, same as most existing sites.
 */
export async function writeConsumer(
  admin: SupabaseClient,
  args: ConsumerWriteArgs,
): Promise<ConsumerWriteResult> {
  const validated = validateConsumerPatch(args.patch);
  if (!validated.ok) return { ok: false, error: validated.error };

  if (args.mode === "insert") {
    const row = { id: args.id, ...validated.patch };
    if (args.select) {
      const { data, error } = await admin
        .from("consumers")
        .insert(row)
        .select(args.select)
        .single();
      if (error) return { ok: false, error: error.message, code: error.code };
      return { ok: true, row: data as unknown as Record<string, unknown> };
    }
    const { error } = await admin.from("consumers").insert(row);
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  if (args.select) {
    const { data, error } = await admin
      .from("consumers")
      .update(validated.patch)
      .eq("id", args.id)
      .select(args.select)
      .single();
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: data as unknown as Record<string, unknown> };
  }
  const { error } = await admin
    .from("consumers")
    .update(validated.patch)
    .eq("id", args.id);
  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, row: null };
}
