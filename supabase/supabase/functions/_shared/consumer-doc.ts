// The consumer aggregate — validator + THE write door (MESITA-1247, "Mesita
// as documents" §C, item 1 of 6). Picked as the FIRST aggregate to route
// because its write surface is the smallest and most bounded of the six:
// 7 call sites across 6 Edge Functions + 1 shared helper, against
// reservation_tickets (10+ files, one with 15+ update sites) and
// visit_tickets (17 files) — see the MESITA-1247 report for the full count
// per aggregate. place/projects/profiles is bigger still (16 files, 29 write
// sites); config and vocab are explicitly out of scope for this issue.
//
// THE TWO-BELT PATTERN (StampableCrenupStep, crenup-report.ts):
//   Belt 1 — TypeScript. ConsumerWriteArgs.patch IS ConsumerPatch (a closed
//     key set), not Record<string, unknown> — a misspelled or retired field
//     name fails to compile at every call site that builds the patch as a
//     typed literal or variable. This belt only holds until a caller casts
//     past it (e.g. `as ConsumerPatch` on raw HTTP JSON) — which is exactly
//     what belt 2 exists for.
//   Belt 2 — runtime. validateConsumerPatch re-checks the same closed key
//     set (HTTP JSON has no compiler) plus the shape invariants below. A
//     malformed patch never reaches Postgres — it just doesn't write, the
//     same rule crenup-report.ts enforces for a piece a run didn't buy.
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
//   - deleted_at, if set, is a timestamp string or null — MESITA-1250:
//     deletion is a state. Only `_shared/delete-history-free.ts` writes it.
//
// birthday format, avatar_url's bucket/path shape, and the age gate are
// deliberately NOT here — they are HTTP-input business rules that need
// context this validator doesn't have (today's date, the caller's userId),
// and consumer-web-update-profile/update-profile-fields.ts already owns
// them. This validator checks the STORED SHAPE only.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isNullableString } from "./doc-schema.ts";

// ── ConsumerDoc — the full row shape ────────────────────────────────────────

export type ConsumerDoc = {
  id: string;
  code: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  sex: "male" | "female" | null;
  birthday: string | null;
  phone: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  instagram_followers_count: number | null;
  // MESITA-2461: when the handle was proved (code in the bio). The DB CHECK
  // refuses a handle without it; only consumer_instagram_verify sets both.
  // A Sync (MESITA-3060) writes the follower count through
  // consumer_instagram_sync and stamps instagram_synced_at, never this.
  instagram_verified_at: string | null;
  // MESITA-2585: may verifying Instagram set the picture? Default true.
  use_instagram_photo: boolean;
  // MESITA-2590: Settings › Social › "Public profile", off = true: no photo
  // or handle in Social, the first name still shows (MESITA-2612).
  // place_activity_visible reads it.
  appear_anonymous: boolean;
  // Not here on purpose: plan, guest_class, the VIP audit columns
  // (MESITA-2553) and the VIP's partner and last day (MESITA-2556). Their only writer is the admin_set_guest_standing RPC, so
  // this door cannot touch them and rejects them as unknown fields.
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
  "phone",
  "avatar_url",
  "instagram_handle",
  "instagram_followers_count",
  "instagram_verified_at",
  "use_instagram_photo",
  "appear_anonymous",
  "deleted_at",
] as const satisfies readonly (keyof Omit<ConsumerDoc, "id" | "created_at">)[];

// Compile-time exhaustiveness check the other direction: if a field is ever
// added to ConsumerDoc and this array is forgotten, `_exhaustive` fails to
// type as `true` and the file stops compiling — the same discipline
// FUNCTION_STATE_KEYS borrows from CRENUP_STEP_META (MESITA-1222).
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
// Consumer QR codes: sequential 8 digits, canonical form 0000-0000 … 9999-9999.
const CODE_RE = /^[0-9]{4}-[0-9]{4}$/;

export function isCanonicalConsumerCode(code: string): boolean {
  return CODE_RE.test(code);
}

const INSTAGRAM_HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/**
 * The consumer aggregate's runtime shape guard. Rejects an unknown key
 * (closed key set), a wrong-typed value, or a value that breaks one of the
 * invariants documented above. Returns the same patch back,
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
  if ("instagram_verified_at" in raw) {
    const v = raw.instagram_verified_at;
    if (!isNullableString(v)) {
      return {
        ok: false,
        error: "instagram_verified_at must be an ISO timestamp string or null",
      };
    }
    patch.instagram_verified_at = v;
  }
  if ("use_instagram_photo" in raw) {
    const v = raw.use_instagram_photo;
    if (typeof v !== "boolean") {
      return { ok: false, error: "use_instagram_photo must be a boolean" };
    }
    patch.use_instagram_photo = v;
  }
  if ("appear_anonymous" in raw) {
    const v = raw.appear_anonymous;
    if (typeof v !== "boolean") {
      return { ok: false, error: "appear_anonymous must be a boolean" };
    }
    patch.appear_anonymous = v;
  }
  if ("deleted_at" in raw) {
    const v = raw.deleted_at;
    if (!isNullableString(v)) {
      return {
        ok: false,
        error: "deleted_at must be an ISO timestamp string or null",
      };
    }
    patch.deleted_at = v;
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
 * against the aggregate's shape, closed key set, and invariants before
 * Postgres ever sees it. `select`, when given, re-reads exactly those
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

// ── readInstagramStatus — what Me › Instagram polls (MESITA-2575) ──────────

/** The guest's proved handle and when it was proved, or nulls. */
export async function readInstagramStatus(
  admin: SupabaseClient,
  consumerId: string,
): Promise<
  | { ok: true; handle: string | null; verifiedAt: string | null }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("consumers")
    .select("instagram_handle, instagram_verified_at")
    .eq("id", consumerId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    handle: (data?.instagram_handle as string | null) ?? null,
    verifiedAt: (data?.instagram_verified_at as string | null) ?? null,
  };
}

// ── readInstagramSyncState — what a Sync reads first (MESITA-3060) ─────────

/** The handle and stored follower count a Sync starts from; `deleted` for a
 *  closed account. A missing row reads as no handle. */
export async function readInstagramSyncState(
  admin: SupabaseClient,
  consumerId: string,
): Promise<
  | {
    ok: true;
    handle: string | null;
    followers: number | null;
    deleted: boolean;
  }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("consumers")
    .select("instagram_handle, instagram_followers_count, deleted_at")
    .eq("id", consumerId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    handle: (data?.instagram_handle as string | null) ?? null,
    followers: (data?.instagram_followers_count as number | null) ?? null,
    deleted: Boolean(data?.deleted_at),
  };
}

// ── disconnectInstagram — Me › Instagram's Disconnect (MESITA-3052) ────────

/** Takes the Instagram off the account: handle, follower count, verified
 *  time, and the picture when it is an Instagram copy (`{id}/instagram-…`,
 *  instagram-avatar.ts's naming; an upload stays). */
export async function disconnectInstagram(
  admin: SupabaseClient,
  consumerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("consumers")
    .select("avatar_url")
    .eq("id", consumerId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const avatar = (data?.avatar_url as string | null) ?? null;
  const fromInstagram = !!avatar && avatar.includes(`${consumerId}/instagram-`);
  const written = await writeConsumer(admin, {
    mode: "update",
    id: consumerId,
    patch: {
      instagram_handle: null,
      instagram_followers_count: null,
      instagram_verified_at: null,
      ...(fromInstagram ? { avatar_url: null } : {}),
    },
  });
  return written.ok ? { ok: true } : { ok: false, error: written.error };
}

// ── readSocialStanding — what Social masks by (MESITA-2594) ───────────────

/** Whether the viewer shows themself in Social: a verified Instagram and the
 *  Public profile switch. You see others' handles only if you show yours. */
export async function readSocialStanding(
  admin: SupabaseClient,
  consumerId: string,
): Promise<
  | {
    ok: true;
    row: {
      instagram_verified_at: string | null;
      appear_anonymous: boolean | null;
    } | null;
  }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("consumers")
    .select("instagram_verified_at, appear_anonymous")
    .eq("id", consumerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    row: data
      ? {
        instagram_verified_at: (data.instagram_verified_at as string | null) ??
          null,
        appear_anonymous: (data.appear_anonymous as boolean | null) ?? null,
      }
      : null,
  };
}

// ── Class joins — Me › Class (MESITA-2984, MESITA-3054) ──────────────────

/** What consumer-web-join-class decides on: the caller's class, and their
 *  Instagram as stored at connect (never what the request says). */
export type ClassJoinRow = {
  guest_class: string | null;
  instagram_handle: string | null;
  instagram_followers_count: number | null;
  guest_class_note: string | null;
};

/** The one read a join makes. `row: null` = no live account. */
export async function readClassJoinRow(
  admin: SupabaseClient,
  consumerId: string,
): Promise<
  { ok: true; row: ClassJoinRow | null } | { ok: false; message: string }
> {
  const { data, error } = await admin
    .from("consumers")
    .select(
      "guest_class, instagram_handle, instagram_followers_count, guest_class_note",
    )
    .eq("id", consumerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  return { ok: true, row: (data as ClassJoinRow | null) ?? null };
}

/** The guest's own class change: a Regular joining VIP, or a VIP leaving it
 *  (MESITA-3054). The caller has read the row and knows the current class.
 *  The write is admin_set_guest_standing, guest_class's one writer, with no
 *  actor (the guest did it, no operator); `note` says how, already merged
 *  with any operator note. Going Regular clears the partner and last day (the
 *  RPC does it). */
export async function writeOwnGuestClass(
  admin: SupabaseClient,
  consumerId: string,
  guestClass: "vip" | "regular",
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: rpcErr } = await admin.rpc("admin_set_guest_standing", {
    p_consumer: consumerId,
    p_guest_class: guestClass,
    p_plan: null,
    p_note: note,
    p_note_set: true,
    p_partner: null,
    p_partner_set: false,
    p_vip_until: null,
    p_vip_until_set: false,
    p_actor: null,
  });
  return rpcErr ? { ok: false, message: rpcErr.message } : { ok: true };
}
