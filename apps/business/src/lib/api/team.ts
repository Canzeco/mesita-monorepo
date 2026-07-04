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
  role: BusinessRole | string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

type TeamStaff = {
  userId: string;
  phone: string | null;
  createdAt: string;
};

type PendingEditorInvite = {
  id: string;
  email: string;
  role: BusinessRole | string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

type PendingStaffInvite = {
  id: string;
  phone: string | null;
  channel: "whatsapp" | "sms";
  token: string;
  createdAt: string;
  expiresAt: string;
};

// `super_admin` is a synthetic role for users in public.super_admins
// who aren't in project_members for this place; the EF still grants them
// owner-level UI affordances.
type CallerRole = BusinessRole | "staff" | "super_admin";

// Note on field naming: the EF returns `businesses` / `pendingBusinessInvites`
// because those rows are joined from the `businesses` (platform-account)
// table. The team UI labels them as "Editors" — that's the per-place tier
// (member_role) name, distinct from the source table name.
export type TeamSnapshot = {
  myRole: CallerRole | null;
  businesses: TeamEditor[];
  staffs: TeamStaff[];
  pendingBusinessInvites: PendingEditorInvite[];
  pendingStaffInvites: PendingStaffInvite[];
};

export async function apiListTeam(
  client: SupabaseClient,
  projectId: string,
): Promise<TeamSnapshot> {
  return await invokeEF<TeamSnapshot>(
    client,
    "business-list-team",
    { projectId },
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
    "business-invite-member",
    input,
    "Couldn't send the invite.",
  );
}

type InviteStaffResult = {
  inviteId: string;
  token: string;
  phone: string | null;
  channel: "whatsapp" | "sms";
  expiresAt: string;
  shareUrl: string | null;
  sent: boolean;
  resent?: boolean;
  sendError?: string | null;
  messageSid?: string | null;
  sendMode?: "template" | "session" | null;
};

export async function apiInviteStaff(
  client: SupabaseClient,
  input: {
    projectId: string;
    channel: "whatsapp" | "sms";
    phone?: string;
    redirectBase?: string;
  },
): Promise<InviteStaffResult> {
  return await invokeEF<InviteStaffResult>(
    client,
    "business-invite-staff",
    input,
    "Couldn't send the staff invite.",
  );
}

export async function apiUpdateMemberRole(
  client: SupabaseClient,
  input: { memberId: string; role: BusinessRole },
): Promise<{ memberId: string; role: BusinessRole }> {
  return await invokeEF<{ memberId: string; role: BusinessRole }>(
    client,
    "business-update-member-role",
    input,
    "Couldn't update that member's role.",
  );
}

export type RemoveKind = "editor" | "staff" | "editorInvite" | "staffInvite";

export async function apiRemoveMember(
  client: SupabaseClient,
  input: { id: string; kind: RemoveKind },
): Promise<{ id: string; kind: RemoveKind }> {
  return await invokeEF<{ id: string; kind: RemoveKind }>(
    client,
    "business-remove-member",
    input,
    "Couldn't remove that member.",
  );
}

export type TestStaffChannelResult = {
  channel: "whatsapp" | "sms";
  to: string;
  sent: boolean;
  mock: boolean;
  note: string;
};

export async function apiTestStaffChannel(
  client: SupabaseClient,
  input: { projectId: string; channel: "whatsapp" | "sms"; phone: string },
): Promise<TestStaffChannelResult> {
  return await invokeEF<TestStaffChannelResult>(
    client,
    "business-test-staff-channel",
    input,
    "Couldn't send the test message.",
  );
}

export async function apiAcceptEditorInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ projectId: string; role: BusinessRole }> {
  return await invokeEF<{ projectId: string; role: BusinessRole }>(
    client,
    "business-accept-invite",
    { token },
    "Couldn't accept the invite.",
  );
}
