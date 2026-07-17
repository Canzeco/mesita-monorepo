// Waiter phone hydration for business-web-list-team.
//
// project_roles only stores user_id; the phone lives on auth.users.
// Until we add a phone column to project_roles we have to read each
// auth user — running them in parallel keeps the latency flat.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { phoneDigits } from "../_shared/phone.ts";

type RoleRow = { user_id: string; role: string; created_at: string };

type PendingWaiterRow = {
  id: string;
  phone: string | null;
  channel: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

/** Safety net if legacy duplicate rows exist before migration is applied. */
export function dedupePendingWaiterInvites(rows: PendingWaiterRow[]): PendingWaiterRow[] {
  const byKey = new Map<string, PendingWaiterRow>();
  for (const row of rows) {
    const key = row.phone ? phoneDigits(row.phone) : row.id;
    const prev = byKey.get(key);
    if (!prev || row.createdAt > prev.createdAt) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function loadWaitersWithPhones(
  admin: SupabaseClient,
  rows: RoleRow[],
): Promise<{ userId: string; phone: string | null; createdAt: string }[]> {
  if (rows.length === 0) return [];
  const phones = await Promise.all(
    rows.map((r) =>
      admin.auth.admin
        .getUserById(r.user_id)
        .then((u) => (u.data.user?.phone ? `+${u.data.user.phone}` : null))
        .catch(() => null),
    ),
  );
  return rows.map((r, i) => ({
    userId: r.user_id,
    phone: phones[i],
    createdAt: r.created_at,
  }));
}
