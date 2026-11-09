"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Guests: Class and Plan (MESITA-2550, MESITA-2553) ──────────────────

export type GuestPlan = "free" | "premium";
export type GuestClass = "regular" | "vip";

export type GuestRow = {
  id: string;
  name: string;
  code: string | null;
  instagram: string | null;
  guestClass: GuestClass;
  plan: GuestPlan;
  /** When an operator last changed the class; null for VIPs carried from Diamond. */
  guestClassSetAt: string | null;
  /** That operator's email, when it still resolves. */
  guestClassSetByEmail: string | null;
  /** Operator-only: where a VIP came from. Never shown to the guest. */
  guestClassNote: string | null;
  /** Operator-set reservations a month (MESITA-2555); null = the plan's cap. */
  reservationCapOverride: number | null;
  /** The plan's monthly cap, what applies while there is no override. */
  planReservationCap: number;
  /** MESITA-2556: the partner this VIP came through, or null. */
  vipPartnerId: string | null;
  /** MESITA-2556: the VIP's last day (YYYY-MM-DD), or null for no end date. */
  vipUntil: string | null;
  createdAt: string;
};

/** A partner VIP comes through (MESITA-2556). With a place, a partner venue. */
export type VipPartner = {
  id: string;
  name: string;
  placeId: string | null;
  placeName: string | null;
};

export type StandingPatch = {
  guestClass?: GuestClass;
  plan?: GuestPlan;
  /** null or blank clears it. */
  guestClassNote?: string | null;
  /** null goes back to the plan's cap. */
  reservationCapOverride?: number | null;
  /** null clears it. */
  vipPartnerId?: string | null;
  /** YYYY-MM-DD; null = no end date. */
  vipUntil?: string | null;
};

/** A VIP invitation code (MESITA-3540). Only the last four are ever shown
 *  again; the whole code is in the answer that issued it. */
export type VipCode = {
  id: string;
  last4: string;
  label: string | null;
  vipPartnerId: string | null;
  status: "unused" | "used" | "revoked";
  createdAt: string;
  usedAt: string | null;
  usedByName: string | null;
  usedByCode: string | null;
  revokedAt: string | null;
};

type ListResult = ActionResult<{
  guests: GuestRow[];
  partners: VipPartner[];
  /** null when the codes read failed (the guests still load). */
  vipCodes: VipCode[] | null;
}>;

export async function listGuests(q = ""): Promise<ListResult> {
  const r = await efInvoke<{
    guests: GuestRow[];
    partners?: VipPartner[];
    vipCodes?: VipCode[] | null;
  }>("admin-web-list-guests", { q });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    guests: r.data.guests ?? [],
    partners: r.data.partners ?? [],
    vipCodes: r.data.vipCodes ?? null,
  };
}

/** Issue a VIP invitation code (shown once, as "1234 5678 9012"). */
export async function issueVipCode(input: {
  label?: string | null;
  vipPartnerId?: string | null;
}): Promise<ActionResult<{ issuedCode: string; codes: VipCode[] | null }>> {
  const r = await efInvoke<{ issuedCode: string; codes: VipCode[] | null }>(
    "admin-web-save-vip-code",
    input,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, issuedCode: r.data.issuedCode, codes: r.data.codes ?? null };
}

/** Revoke an unused VIP invitation code. */
export async function revokeVipCode(id: string): Promise<ActionResult<{ codes: VipCode[] | null }>> {
  const r = await efInvoke<{ codes: VipCode[] | null }>("admin-web-save-vip-code", {
    id,
    revoke: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, codes: r.data.codes ?? null };
}

/** Add a partner (no id) or rename one. googlePlaceId: undefined leaves the
 *  place as it is, "" or null makes it not a place. */
export async function saveVipPartner(input: {
  id?: string;
  name: string;
  googlePlaceId?: string | null;
}): Promise<ActionResult<{ partners: VipPartner[] }>> {
  const r = await efInvoke<{ partners: VipPartner[] }>("admin-web-save-vip-partner", input);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, partners: r.data.partners ?? [] };
}

/** A refusal keeps its HTTP status: 0 means the save may or may not have landed. */
type SetResult =
  | { ok: true; guest: GuestRow }
  | { ok: false; error: string; status: number };

export async function setGuestStanding(
  consumerId: string,
  patch: StandingPatch,
): Promise<SetResult> {
  const r = await efInvoke<{ guest: GuestRow }>("admin-web-set-guest-standing", {
    consumerId,
    ...patch,
  });
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  return { ok: true, guest: r.data.guest };
}
