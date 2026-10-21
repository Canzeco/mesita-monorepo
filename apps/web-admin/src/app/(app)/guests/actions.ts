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
  createdAt: string;
};

export type StandingPatch = {
  guestClass?: GuestClass;
  plan?: GuestPlan;
  /** null or blank clears it. */
  guestClassNote?: string | null;
};

type ListResult = ActionResult<{ guests: GuestRow[] }>;

export async function listGuests(q = ""): Promise<ListResult> {
  const r = await efInvoke<{ guests: GuestRow[] }>("admin-web-list-guests", { q });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, guests: r.data.guests ?? [] };
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
