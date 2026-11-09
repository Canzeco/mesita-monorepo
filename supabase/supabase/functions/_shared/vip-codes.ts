// VIP invitation codes (MESITA-3540): the twelve digits an operator issues on
// Admin › Guests and a guest types once on Me › Class. Only the SHA-256 of the
// digits and the last four are stored, so the operator sees a code exactly
// once, in the answer that issued it. consumer_redeem_vip_invitation (SQL)
// hashes the same way: sha256 of the twelve ASCII digits, lowercase hex.
//
// admin-web-save-vip-code issues or revokes; admin-web-list-guests lists.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { readGuestLabels } from "./consumer-doc.ts";

export const VIP_CODE_LABEL_MAX = 80;
/** How many codes Admin › Guests lists, newest first. */
export const VIP_CODE_LIST_LIMIT = 100;

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
  | { action: "revoke"; id: string };

export type VipCodeError = { status: number; code: string; error: string };

/** The body of a save call: `{ label?, vipPartnerId? }` issues; `{ id, revoke: true }` revokes. */
export function readSaveVipCodeBody(
  body: unknown,
): ({ ok: true } & SaveVipCodeBody) | ({ ok: false } & VipCodeError) {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
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

/** The newest codes, with who used each. */
export async function loadVipCodes(
  admin: SupabaseClient,
): Promise<{ ok: true; codes: VipCode[] } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("vip_invitation_codes")
    .select("id, code_last4, label, vip_partner_id, created_at, used_at, used_by, revoked_at")
    .order("created_at", { ascending: false })
    .limit(VIP_CODE_LIST_LIMIT);
  if (error) return { ok: false, error: `vip_codes_read: ${error.message}` };
  const rows = (data ?? []) as RawCode[];
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
