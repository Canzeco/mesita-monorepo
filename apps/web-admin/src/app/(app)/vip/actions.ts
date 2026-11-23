"use server";

// Manage › VIP (MESITA-4766): thin wrappers over admin-web-list-guests
// (vipOnly) and admin-web-save-vip-code (issue, revoke, remove a guest's VIP).

import { efInvoke } from "@/lib/supabase-ef";

export type VipCodeStatus = "unused" | "used" | "revoked";

/** One invitation code as _shared/vip-codes.ts loadVipCodes returns it. */
export type VipCode = {
  id: string;
  last4: string;
  label: string | null;
  status: VipCodeStatus;
  createdAt: string;
  usedAt: string | null;
  usedByName: string | null;
  usedByCode: string | null;
  revokedAt: string | null;
};

/** One VIP guest as admin-web-list-guests returns it with `vipOnly: true`. */
export type VipGuest = {
  id: string;
  name: string;
  code: string | null;
  instagram: string | null;
  guestClassSetAt: string | null;
  vipInvitedAt: string | null;
  vipReason: "code" | "instagram" | null;
  vipCodeLast4: string | null;
  followers: number | null;
  followersEmulated: number | null;
  /** The live money rule: does a bill today pay as VIP. */
  paidAsVip: boolean;
};

/** A failure keeps the EF's code, so the page can react (a 409 refreshes the list). */
type Fail = { ok: false; error: string; code: string | null };

/** The codes ride under `vipCodes` here (null when that read failed). */
type ListReply = { guests?: VipGuest[]; vipCodes?: VipCode[] | null };

export async function listVip(): Promise<
  { ok: true; guests: VipGuest[]; codes: VipCode[] | null } | Fail
> {
  const r = await efInvoke<ListReply>("admin-web-list-guests", { vipOnly: true });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return { ok: true, guests: r.data.guests ?? [], codes: r.data.vipCodes ?? null };
}

/** Issue a code. `issuedCode` is the full twelve digits, in this answer only. */
export async function issueVipCode(
  label: string,
): Promise<{ ok: true; issuedCode: string; codes: VipCode[] | null } | Fail> {
  const r = await efInvoke<{ issuedCode?: string; codes?: VipCode[] | null }>("admin-web-save-vip-code", { label });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  if (!r.data.issuedCode) return { ok: false, error: "The server answered without a code.", code: null };
  return { ok: true, issuedCode: r.data.issuedCode, codes: r.data.codes ?? null };
}

/** Revoke an unused code. 409 code_not_unused: it was used or revoked meanwhile. */
export async function revokeVipCode(id: string): Promise<{ ok: true; codes: VipCode[] | null } | Fail> {
  const r = await efInvoke<{ codes?: VipCode[] | null }>("admin-web-save-vip-code", { id, revoke: true });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return { ok: true, codes: r.data.codes ?? null };
}

/** Take VIP away from a guest who came in by code. The code stays used. */
export async function removeGuestVip(consumerId: string): Promise<{ ok: true } | Fail> {
  const r = await efInvoke<Record<string, unknown>>("admin-web-save-vip-code", { consumerId, removeVip: true });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return { ok: true };
}
