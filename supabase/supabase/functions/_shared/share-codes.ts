// MESITA-5060 — share codes: who shared a link, so a share's new guests count.
//
// A guest's code rides on every link they share (?s=<code>). Opening such a
// link records one share_opens row per code × place × browser; a NEW account
// made within SHARE_WINDOW_DAYS of opening one is credited to that code once
// (share_signups). Pure rules first, then the two database steps.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { resolvePlaceRef } from "./share-place-ref.ts";

/** How long an opened link can still credit the account it leads to. */
export const SHARE_WINDOW_DAYS = 30;
/** An account counts as new when signin-phone sees it this soon after it was made. */
export const NEW_ACCOUNT_MINUTES = 60;

// No 0/o, 1/l/i: a code may be read aloud or retyped.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function isShareCode(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9]{8}$/.test(v);
}

/** The browser's own random id; never an account, never a location. */
export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

/** A place as a link names it: its id or its slug. */
export function isPlaceRef(v: unknown): v is string {
  return typeof v === "string" && (isUuid(v) || /^[a-z0-9][a-z0-9-]{0,119}$/.test(v));
}

export function newShareCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export type CreditInput = {
  consumerId: string;
  consumerCreatedAt: string | null;
  sharerId: string | null;
  openedAt: string | null;
  now: Date;
};

export type CreditVerdict = "credit" | "unknown_code" | "own_code" | "not_new" | "expired";

/** Whether a sign-in may credit a share: only a new account, only someone
 *  else's code, only a link opened inside the window. */
export function creditVerdict(i: CreditInput): CreditVerdict {
  if (!i.sharerId) return "unknown_code";
  if (i.sharerId === i.consumerId) return "own_code";
  const created = i.consumerCreatedAt ? Date.parse(i.consumerCreatedAt) : NaN;
  if (!Number.isFinite(created) || i.now.getTime() - created > NEW_ACCOUNT_MINUTES * 60_000) return "not_new";
  if (i.openedAt) {
    const opened = Date.parse(i.openedAt);
    if (!Number.isFinite(opened) || opened > i.now.getTime() + 60_000) return "expired";
    if (i.now.getTime() - opened > SHARE_WINDOW_DAYS * 86_400_000) return "expired";
  }
  return "credit";
}

/** The guest's code, made on first ask. */
export async function ensureShareCode(
  admin: SupabaseClient,
  consumerId: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await admin.from("share_codes").select("code").eq("consumer_id", consumerId).maybeSingle();
    if (existing.error) return { ok: false, error: `share_codes read: ${existing.error.message}` };
    if (existing.data?.code) return { ok: true, code: existing.data.code as string };
    const ins = await admin.from("share_codes").insert({ consumer_id: consumerId, code: newShareCode() });
    // 23505: this guest got a code in a race, or the code was taken. Read again.
    if (ins.error && ins.error.code !== "23505") return { ok: false, error: `share_codes insert: ${ins.error.message}` };
  }
  return { ok: false, error: "share_codes: conflict" };
}

export type ShareClaim = { code: string; place: string | null; openedAt: string | null };

/** Read a claim from a request body's `share` field; null when absent or malformed. */
export function readShareClaim(v: unknown): ShareClaim | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isShareCode(o.code)) return null;
  const place = isPlaceRef(o.place) ? o.place : null;
  const openedAt = typeof o.opened_at === "string" && Number.isFinite(Date.parse(o.opened_at)) ? o.opened_at : null;
  return { code: o.code, place, openedAt };
}

/** Credit a new account to the code it came through. `accountCreatedAt` is
 *  the Auth user's own created_at: when the account itself was made. Never
 *  throws; the sign-in it rides on must not fail over a count. */
export async function creditShareSignup(
  admin: SupabaseClient,
  consumerId: string,
  accountCreatedAt: string | null,
  claim: ShareClaim,
  now = new Date(),
): Promise<CreditVerdict | "error"> {
  try {
    const sharer = await admin.from("share_codes").select("consumer_id").eq("code", claim.code).maybeSingle();
    if (sharer.error) return "error";
    const verdict = creditVerdict({
      consumerId,
      consumerCreatedAt: accountCreatedAt,
      sharerId: (sharer.data?.consumer_id as string | undefined) ?? null,
      openedAt: claim.openedAt,
      now,
    });
    if (verdict !== "credit") return verdict;
    const placeId = await resolvePlaceRef(admin, claim.place);
    const ins = await admin.from("share_signups").insert({
      consumer_id: consumerId,
      sharer_id: sharer.data!.consumer_id,
      place_id: placeId,
      opened_at: claim.openedAt,
    });
    // 23505: already credited (the first code wins).
    if (ins.error && ins.error.code !== "23505") return "error";
    return "credit";
  } catch {
    return "error";
  }
}
