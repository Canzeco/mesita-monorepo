"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Admin allowlist (super_admins) ─────────────────────────────────────

export type AdminRow = {
  email: string;
  note: string | null;
  created_at: string;
  added_by: string | null;
};

type ListResult = ActionResult<{ admins: AdminRow[]; self: string | null }>;

export async function listAdmins(): Promise<ListResult> {
  const r = await efInvoke<{ admins: AdminRow[]; self: string | null }>(
    "admin-web-list-admins",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, admins: r.data.admins ?? [], self: r.data.self ?? null };
}

type GrantResult = ActionResult<{ admin: AdminRow }>;

export async function grantAdmin(
  email: string,
  note: string,
): Promise<GrantResult> {
  const r = await efInvoke<{ admin: AdminRow }>("admin-web-grant-admin", {
    email,
    note,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, admin: r.data.admin };
}

type RevokeResult = ActionResult<{ removed: number }>;

export async function revokeAdmin(email: string): Promise<RevokeResult> {
  const r = await efInvoke<{ removed: number }>("admin-web-revoke-admin", { email });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, removed: r.data.removed ?? 0 };
}
