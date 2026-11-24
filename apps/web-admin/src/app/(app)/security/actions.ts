"use server";

// Security › Suspensions (MESITA-4899).

import { efInvoke } from "@/lib/supabase-ef";

export type Suspension = { id: string; guest: string; place: string | null; closures: number; suspended_at: string; reinstated_at: string | null };
export type Closure = { id: string; guest: string; place: string | null; created_at: string };

export async function listSecurity(): Promise<{ ok: true; suspensions: Suspension[]; closures: Closure[] } | { ok: false; error: string }> {
  const r = await efInvoke<{ suspensions?: Suspension[]; closures?: Closure[] }>("admin-web-list-security", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, suspensions: r.data.suspensions ?? [], closures: r.data.closures ?? [] };
}

export async function reinstateGuest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await efInvoke<Record<string, unknown>>("admin-web-reinstate-guest", { suspension_id: id });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
