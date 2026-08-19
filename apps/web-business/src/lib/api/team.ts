// Frontend API surface for the Team page.
//
// Same constraints as the other api/* helpers: no direct DB access,
// one Edge Function per call, errors unwrapped by invokeEF.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, withPlaceId } from "./_invoke";

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

export async function apiListTeam(
  client: SupabaseClient,
  projectId: string,
): Promise<TeamSnapshot> {
  return await invokeEF<TeamSnapshot>(
    client,
    "business-web-list-members",
    // Canonical payload key is `placeId` (MESITA-26); local naming unchanged.
    { placeId: projectId },
    "Couldn't load your team.",
  );
}

type InviteEditorResult =
  | {
      mode: "linked";
      memberId: string;
      email: string;
      role: BusinessRole;
    }
  | {
      mode: "invited";
      inviteId: string;
      token: string;
      expiresAt: string;
      email: string;
      role: BusinessRole;
      emailSent: boolean;
      emailError: string | null;
    };

export async function apiInviteEditor(
  client: SupabaseClient,
  input: {
    projectId: string;
    email: string;
    role: BusinessRole;
    redirectBase?: string;
  },
): Promise<InviteEditorResult> {
  return await invokeEF<InviteEditorResult>(
    client,
    "business-web-invite-member",
    withPlaceId(input),
    "Couldn't send the invite.",
  );
}

export async function apiUpdateMemberRole(
  client: SupabaseClient,
  input: { memberId: string; role: BusinessRole },
): Promise<{ memberId: string; role: BusinessRole }> {
  return await invokeEF<{ memberId: string; role: BusinessRole }>(
    client,
    "business-web-update-member-role",
    input,
    "Couldn't update that member's role.",
  );
}

export type RemoveKind = "editor" | "editorInvite";

export async function apiRemoveMember(
  client: SupabaseClient,
  input: { id: string; kind: RemoveKind },
): Promise<{ id: string; kind: RemoveKind }> {
  return await invokeEF<{ id: string; kind: RemoveKind }>(
    client,
    "business-web-remove-member",
    input,
    "Couldn't remove that member.",
  );
}

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
