// The guest's own ticket, loaded for an app door (cancel, update, confirm).
// Ownership is re-checked server-side — an id alone is never authority — and
// "doesn't exist" and "not yours" come back the same (row null), so a caller
// never leaks existence. Each door keeps its own 404 wording.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export async function readOwnedTicket<
  T extends { consumer_id: string | null; is_test?: boolean | null },
>(
  admin: SupabaseClient,
  id: string,
  userId: string,
  cols: string,
  opts: { excludeTest?: boolean } = {},
): Promise<{ row: T | null; error: string | null }> {
  const { data, error } = await admin
    .from("reservation_tickets")
    .select(cols)
    .eq("id", id)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  const row = (data ?? null) as T | null;
  if (!row || row.consumer_id !== userId) return { row: null, error: null };
  // Test tickets stay invisible to the doors that exclude them.
  if (opts.excludeTest && row.is_test) return { row: null, error: null };
  return { row, error: null };
}
