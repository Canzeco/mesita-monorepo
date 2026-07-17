import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";

export type Kind = "editor" | "waiter" | "editorInvite" | "waiterInvite";

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
        .select("project_id, business_id, role")
        .eq("id", id)
        .maybeSingle();
      if (row.error) return notFound(`member_read: ${row.error.message}`, 500);
      if (!row.data) return notFound("Member not found.", 404);
      return {
        ok: true,
        projectId: row.data.project_id,
        isSelfRemoval: row.data.business_id === callerId,
        targetIsOwner: row.data.role === "owner",
      };
    }
    case "waiter": {
      const [userId, placeIdFromKey] = id.split(":");
      if (!userId || !placeIdFromKey) {
        return notFound("id must be userId:projectId", 400);
      }
      const row = await admin
        .from("project_roles")
        .select("user_id, project_id")
        .eq("user_id", userId)
        .eq("project_id", placeIdFromKey)
        .maybeSingle();
      if (row.error) return notFound(`role_read: ${row.error.message}`, 500);
      if (!row.data) return notFound("Waiter not found on this place.", 404);
      return {
        ok: true,
        projectId: row.data.project_id,
        isSelfRemoval: false,
        targetIsOwner: false,
      };
    }
    case "editorInvite":
      return await loadInvite(admin, "account_invites", id);
    case "waiterInvite":
      return await loadInvite(admin, "staff_invites", id);
  }
}

export async function loadInvite(
  admin: SupabaseClient,
  table: "account_invites" | "staff_invites",
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
    case "waiter": {
      const [userId, placeIdFromKey] = id.split(":");
      return await admin
        .from("project_roles")
        .delete()
        .eq("user_id", userId)
        .eq("project_id", placeIdFromKey);
    }
    case "editorInvite":
      return await admin.from("account_invites").delete().eq("id", id);
    case "waiterInvite":
      return await admin.from("staff_invites").delete().eq("id", id);
  }
}
