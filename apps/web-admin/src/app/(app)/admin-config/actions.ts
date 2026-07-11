"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Reset database ─────────────────────────────────────────────────────

type ResetResponse = {
  result?: {
    deleted_auth_users?: number;
    reset_at?: string;
  };
};

type ResetResult =
  | { ok: true; deletedAuthUsers: number | null }
  | { ok: false; error: string };

// Calls the admin-reset-database EF. The EF re-checks super_admins and
// requires confirm === "RESET", so this action is only a thin pass-through.
export async function resetDatabase(confirm: string): Promise<ResetResult> {
  const r = await efInvoke<ResetResponse>("admin-web-reset-database", { confirm });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    deletedAuthUsers: r.data.result?.deleted_auth_users ?? null,
  };
}

// ─── Admin allowlist (super_admins) ─────────────────────────────────────

export type AdminRow = {
  email: string;
  note: string | null;
  created_at: string;
  added_by: string | null;
};

type ListResult =
  | { ok: true; admins: AdminRow[]; self: string | null }
  | { ok: false; error: string };

export async function listAdmins(): Promise<ListResult> {
  const r = await efInvoke<{ admins: AdminRow[]; self: string | null }>(
    "admin-web-list-admins",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, admins: r.data.admins ?? [], self: r.data.self ?? null };
}

type GrantResult =
  | { ok: true; admin: AdminRow }
  | { ok: false; error: string };

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

type RevokeResult =
  | { ok: true; removed: number }
  | { ok: false; error: string };

export async function revokeAdmin(email: string): Promise<RevokeResult> {
  const r = await efInvoke<{ removed: number }>("admin-web-revoke-admin", { email });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, removed: r.data.removed ?? 0 };
}
