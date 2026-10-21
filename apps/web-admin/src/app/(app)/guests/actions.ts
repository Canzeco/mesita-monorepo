"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Guests: Diamond and plan (MESITA-2550) ─────────────────────────────

export type GuestPlan = "free" | "premium";

export type GuestRow = {
  id: string;
  name: string;
  code: string | null;
  instagram: string | null;
  diamond: boolean;
  plan: GuestPlan;
  createdAt: string;
};

type ListResult = ActionResult<{ guests: GuestRow[] }>;

export async function listGuests(q = ""): Promise<ListResult> {
  const r = await efInvoke<{ guests: GuestRow[] }>("admin-web-list-guests", { q });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, guests: r.data.guests ?? [] };
}

type SetResult = ActionResult<{ guest: GuestRow }>;

export async function setGuestStanding(
  consumerId: string,
  patch: { diamond?: boolean; plan?: GuestPlan },
): Promise<SetResult> {
  const r = await efInvoke<{ guest: GuestRow }>("admin-web-set-guest-standing", {
    consumerId,
    ...patch,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, guest: r.data.guest };
}
