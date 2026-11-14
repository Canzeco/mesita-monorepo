"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

/** One reservation ticket as admin-web-list-reservations returns it. */
export type AdminReservation = {
  id: string;
  reserved_at: string;
  party_size: number;
  state: string;
  /** Derived server-side: confirmed and its time more than 4 h behind us. */
  passed: boolean;
  reference_code: string | null;
  notes: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  is_test: boolean;
  attempts_state: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  consumer_id: string | null;
  consumer_first_name: string | null;
  member_number: string | null;
  place: { id: string; slug: string | null; name: string | null; timezone: string } | null;
};

export type ListReservationsResult = ActionResult<{
  reservations: AdminReservation[];
  capped: boolean;
}>;

/** Every reservation ticket, newest first (admin-web-list-reservations,
 *  MESITA-3960). Read-only. */
export async function listReservations(): Promise<ListReservationsResult> {
  const r = await efInvoke<{ reservations?: AdminReservation[]; capped?: boolean }>(
    "admin-web-list-reservations",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, reservations: r.data.reservations ?? [], capped: r.data.capped === true };
}
