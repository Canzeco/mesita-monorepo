// VIP invitation codes (MESITA-3540, back with MESITA-4766): the twelve
// digits an operator issues on Admin › VIP and a guest types once on
// Me › Become VIP (consumer-web-redeem-vip-code). Only the SHA-256 of the
// digits and the last four are stored, so the operator sees a code exactly
// once, in the answer that issued it. consumer_redeem_vip_invitation (SQL)
// hashes the same way: sha256 of the twelve ASCII digits, lowercase hex.
//
// admin-web-save-vip-code issues or revokes; admin-web-list-guests lists.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { readGuestLabels } from "./consumer-doc.ts";

export const VIP_CODE_LABEL_MAX = 80;
/** How many used or revoked codes Admin › VIP lists, newest first. Every
 *  unused code is listed: it can still be revoked (MESITA-4912). */
export const VIP_CODE_PAST_LIMIT = 100;

const PAGE = 500;
type Page<T> = { data: T[] | null; error: { message: string } | null };

/** Every row of an ordered read, a page at a time (PostgREST caps one answer
 *  at max_rows). Throws on a failed page: a part is never shown as the whole. */
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<Page<T>>, page = PAGE): Promise<T[]> {
  const out: T[] = [];
  for (;;) {
    const { data, error } = await read(out.length, out.length + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < page) return out;
  }
}

/** Runs `job` over `items` a chunk at a time: ids ride the URL, and one call
 *  per guest must not open hundreds at once. */
async function inChunks<T, R>(items: T[], size: number, job: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...await job(items.slice(i, i + size)));
  return out;
}

export type VipCodeStatus = "unused" | "used" | "revoked";

export type VipCode = {
  id: string;
  last4: string;
  label: string | null;
  vipPartnerId: string | null;
  status: VipCodeStatus;
  createdAt: string;
  usedAt: string | null;
  /** The guest who used it: name and member number, when it still resolves. */
  usedByName: string | null;
  usedByCode: string | null;
  revokedAt: string | null;
};

/** MESITA-4766: the redeem body `{ code }`: twelve digits once spaces and
 *  dashes are stripped, kept as text (a leading zero is a digit). */
export function readRedeemVipCodeBody(body: unknown): { ok: true; code: string } | { ok: false } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.code !== "string") return { ok: false };
  const code = b.code.replace(/[\s-]/g, "");
  return /^[0-9]{12}$/.test(code) ? { ok: true, code } : { ok: false };
}

/** MESITA-4766: the extra columns Admin › VIP reads per VIP guest. */
export const VIP_GUEST_EXTRA_SELECT = "vip_invited_at, vip_invitation_code_id, instagram_followers_count, instagram_followers_emulated";

export type VipGuestRaw = {
  id: string;
  guest_class?: string | null;
  vip_invited_at?: string | null;
  vip_invitation_code_id?: string | null;
  instagram_followers_count?: number | null;
  instagram_followers_emulated?: number | null;
};

export type VipGuestFacts = {
  vipInvitedAt: string | null;
  vipReason: "code" | "instagram" | null;
  vipCodeLast4: string | null;
  followers: number | null;
  followersEmulated: number | null;
  /** Whether a later bill pays Returning VIP now (consumer_is_vip_for_money). */
  paidAsVip: boolean;
};

/** Admin › VIP: each VIP guest's why, followers and money status. One batched
 *  code read; one money-rule call per VIP guest, 25 at a time. Throws on a
 *  failed read: a wrong "Paid as VIP" is worse than none. */
export async function readVipGuestFacts(admin: SupabaseClient, rows: VipGuestRaw[], livemode: boolean): Promise<Map<string, VipGuestFacts>> {
  const codeIds = [...new Set(rows.map((r) => r.vip_invitation_code_id).filter((v): v is string => typeof v === "string"))];
  const last4 = new Map<string, string>();
  const found = await inChunks(codeIds, 100, async (ids) => {
    const { data, error } = await admin.from("vip_invitation_codes").select("id, code_last4").in("id", ids);
    if (error) throw new Error(`vip_invitation_codes: ${error.message}`);
    return data ?? [];
  });
  for (const c of found) last4.set(c.id as string, c.code_last4 as string);
  const paid = await inChunks(rows, 25, (some) => Promise.all(some.map(async (r) => {
    const { data, error } = await admin.rpc("consumer_is_vip_for_money", { p_consumer: r.id, p_livemode: livemode });
    if (error) throw new Error(`consumer_is_vip_for_money: ${error.message}`);
    return data === true;
  })));
  const out = new Map<string, VipGuestFacts>();
  rows.forEach((r, i) => {
    out.set(String(r.id), {
      vipInvitedAt: r.vip_invited_at ?? null,
      vipReason: vipReason(r),
      vipCodeLast4: r.vip_invitation_code_id ? last4.get(r.vip_invitation_code_id) ?? null : null,
      followers: typeof r.instagram_followers_count === "number" ? r.instagram_followers_count : null,
      followersEmulated: typeof r.instagram_followers_emulated === "number" ? r.instagram_followers_emulated : null,
      paidAsVip: paid[i],
    });
  });
  return out;
}

/** MESITA-4766: the redeem RPC's jsonb → the EF's answer. Pure. */
export function redeemAnswer(data: unknown): { status: number; body: Record<string, unknown> } {
  const r = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  switch (r.outcome) {
    case "joined":
    case "already_vip":
      return { status: 200, body: { ok: true, outcome: r.outcome } };
    case "invalid":
      return { status: 422, body: { ok: false, code: "code_invalid", error: "That code doesn't work" } };
    case "rate_limited": {
      const s = Number(r.retry_after_seconds);
      return {
        status: 429,
        body: { ok: false, code: "too_many_tries", error: "Too many tries. Try again in an hour.", retryAfterSeconds: Number.isFinite(s) && s > 0 ? Math.ceil(s) : 3600 },
      };
    }
    case "consumer_not_found":
      return { status: 404, body: { ok: false, code: "consumer_not_found", error: "Sign in again" } };
    default:
      return { status: 500, body: { ok: false, code: "save_failed", error: "Couldn't check the code. Try again." } };
  }
}

/** MESITA-4766: why this guest is VIP — 'code' when an invitation code made
 *  them VIP, 'instagram' for a follower VIP (guest_class), null for a Regular. */
export function vipReason(c: { guest_class?: string | null; vip_invited_at?: string | null }): "code" | "instagram" | null {
  if (c.vip_invited_at) return "code";
  return c.guest_class === "vip" ? "instagram" : null;
}

/** Twelve uniformly random digits. Rejection sampling keeps every digit
 *  unbiased (a byte mod 10 would favour 0..5). */
export function newVipCode(random: (buf: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  let out = "";
  while (out.length < 12) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < 250 && out.length < 12) out += String(byte % 10);
    }
  }
  return out;
}

/** sha256 of the twelve ASCII digits, lowercase hex: what the table stores
 *  and what the SQL redeem computes. */
export async function hashVipCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "1234 5678 9012": how the code is shown to the operator once. */
export function formatVipCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8, 12)}`;
}

export type SaveVipCodeBody =
  | { action: "issue"; label: string | null; vipPartnerId: string | null }
  | { action: "revoke"; id: string }
  | { action: "removeVip"; consumerId: string };

export type VipCodeError = { status: number; code: string; error: string };

/** The body of a save call: `{ label?, vipPartnerId? }` issues; `{ id, revoke: true }` revokes;
 *  `{ consumerId, removeVip: true }` takes a code-made VIP away (MESITA-4766). */
export function readSaveVipCodeBody(
  body: unknown,
): ({ ok: true } & SaveVipCodeBody) | ({ ok: false } & VipCodeError) {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (b.removeVip === true) {
    const consumerId = typeof b.consumerId === "string" ? b.consumerId.trim().toLowerCase() : "";
    if (!isUuid(consumerId)) return { ok: false, status: 400, code: "invalid_consumer_id", error: "consumerId must be a guest's id" };
    return { ok: true, action: "removeVip", consumerId };
  }
  if (b.revoke === true) {
    const id = typeof b.id === "string" ? b.id.trim().toLowerCase() : "";
    if (!isUuid(id)) return { ok: false, status: 400, code: "invalid_code_id", error: "id must be a code's id" };
    return { ok: true, action: "revoke", id };
  }
  let label: string | null = null;
  if (b.label !== undefined && b.label !== null) {
    if (typeof b.label !== "string") {
      return { ok: false, status: 400, code: "invalid_label", error: "label must be text" };
    }
    const l = b.label.replace(/\s+/g, " ").trim();
    if (l.length > VIP_CODE_LABEL_MAX) {
      return {
        ok: false,
        status: 400,
        code: "label_too_long",
        error: `label is ${l.length} characters; the limit is ${VIP_CODE_LABEL_MAX}`,
      };
    }
    label = l === "" ? null : l;
  }
  let vipPartnerId: string | null = null;
  if (b.vipPartnerId !== undefined && b.vipPartnerId !== null && b.vipPartnerId !== "") {
    const p = typeof b.vipPartnerId === "string" ? b.vipPartnerId.trim().toLowerCase() : "";
    if (!isUuid(p)) {
      return { ok: false, status: 400, code: "invalid_partner", error: "vipPartnerId must be a partner's id" };
    }
    vipPartnerId = p;
  }
  return { ok: true, action: "issue", label, vipPartnerId };
}

type RawCode = {
  id: string;
  code_last4: string;
  label: string | null;
  vip_partner_id: string | null;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
};

export function codeStatus(r: { used_at: string | null; revoked_at: string | null }): VipCodeStatus {
  if (r.revoked_at) return "revoked";
  if (r.used_at) return "used";
  return "unused";
}

/** Every unused code and the newest used or revoked ones, with who used each. */
export async function loadVipCodes(
  admin: SupabaseClient,
): Promise<{ ok: true; codes: VipCode[] } | { ok: false; error: string }> {
  const select = "id, code_last4, label, vip_partner_id, created_at, used_at, used_by, revoked_at";
  let unused: RawCode[];
  try {
    unused = await readAllPages<RawCode>((from, to) =>
      admin.from("vip_invitation_codes").select(select).is("used_at", null).is("revoked_at", null)
        .order("created_at", { ascending: false }).order("id").range(from, to)
    );
  } catch (err) {
    return { ok: false, error: `vip_codes_read: ${err instanceof Error ? err.message : String(err)}` };
  }
  const past = await admin.from("vip_invitation_codes").select(select)
    .or("used_at.not.is.null,revoked_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(VIP_CODE_PAST_LIMIT);
  if (past.error) return { ok: false, error: `vip_codes_read: ${past.error.message}` };
  // Once each: a code used between the two reads is in both.
  const byId = new Map([...unused, ...((past.data ?? []) as RawCode[])].map((r) => [r.id, r]));
  const rows = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const userIds = [...new Set(rows.map((r) => r.used_by).filter((v): v is string => !!v))];
  const read = await readGuestLabels(admin, userIds);
  if (!read.ok) return { ok: false, error: `vip_code_guests_read: ${read.message}` };
  const guests = read.guests;
  return {
    ok: true,
    codes: rows.map((r) => ({
      id: r.id,
      last4: r.code_last4,
      label: r.label,
      vipPartnerId: r.vip_partner_id,
      status: codeStatus(r),
      createdAt: r.created_at,
      usedAt: r.used_at,
      usedByName: r.used_by ? guests.get(r.used_by)?.name ?? null : null,
      usedByCode: r.used_by ? guests.get(r.used_by)?.code ?? null : null,
      revokedAt: r.revoked_at,
    })),
  };
}
