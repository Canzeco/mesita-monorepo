import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";

// Only the BUSINESS team is removable here. The waiter kinds were retired
// (MESITA-833) along with project_roles / staff_invites — staff hold no
// account, so there is nothing to revoke.
export type Kind = "editor" | "editorInvite";

export type LoadedTarget =
  | {
      ok: true;
      projectId: string;
      isSelfRemoval: boolean;
      targetIsOwner: boolean;
    }
  | { ok: false; response: Response };

export async function loadTarget(
  admin: SupabaseClient,
  kind: Kind,
  id: string,
  callerId: string,
): Promise<LoadedTarget> {
  switch (kind) {
    case "editor": {
      const row = await admin
        .from("project_members")
        .select("project_id, manager_id, role")
        .eq("id", id)
        .maybeSingle();
      if (row.error) return notFound(`member_read: ${row.error.message}`, 500);
      if (!row.data) return notFound("Member not found.", 404);
      return {
        ok: true,
        projectId: row.data.project_id,
        isSelfRemoval: row.data.manager_id === callerId,
        targetIsOwner: row.data.role === "owner",
      };
    }
    case "editorInvite":
      return await loadInvite(admin, "project_invites", id);
  }
}

export async function loadInvite(
  admin: SupabaseClient,
  table: "project_invites",
  id: string,
): Promise<LoadedTarget> {
  const row = await admin.from(table).select("project_id").eq("id", id).maybeSingle();
  if (row.error) return notFound(`invite_read: ${row.error.message}`, 500);
  if (!row.data) return notFound("Invite not found.", 404);
  return {
    ok: true,
    projectId: row.data.project_id,
    isSelfRemoval: false,
    targetIsOwner: false,
  };
}

export function notFound(error: string, status: number): { ok: false; response: Response } {
  return { ok: false, response: json({ ok: false, error }, status) };
}

export async function deleteTarget(admin: SupabaseClient, kind: Kind, id: string) {
  switch (kind) {
    case "editor":
      return await admin.from("project_members").delete().eq("id", id);
    case "editorInvite":
      return await admin.from("project_invites").delete().eq("id", id);
  }
}
