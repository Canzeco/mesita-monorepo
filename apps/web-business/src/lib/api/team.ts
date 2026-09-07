// Frontend API surface for the Team page.
//
// Same constraints as the other api/* helpers: no direct DB access,
// one Edge Function per call, errors unwrapped by invokeEF.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// project_members.role DB enum — per-place tier (distinct from the
// platform-level "business" app role). Migration 0025 renamed
// 'manager' → 'editor'.
export type BusinessRole = "owner" | "editor" | "viewer";

type TeamEditor = {
  memberId: string;
  userId: string;
  role: BusinessRole;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

type PendingEditorInvite = {
  id: string;
  email: string;
  role: BusinessRole;
  token: string;
  createdAt: string;
  expiresAt: string;
};

// Note on field naming: the EF returns `members` / `pendingBusinessInvites`.
// The team UI labels members as "Editors" — that's the per-place tier
// (member_role) name, distinct from the managers table.
export type TeamSnapshot = {
  myRole: BusinessRole | null;
  members: TeamEditor[];
  pendingBusinessInvites: PendingEditorInvite[];
};

export async function apiAcceptEditorInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ projectId: string; role: BusinessRole }> {
  return await invokeEF<{ projectId: string; role: BusinessRole }>(
    client,
    "business-web-accept-invite",
    { token },
    "Couldn't accept the invite.",
  );
}
