// Frontend API surface for the Team page.
//
// Same constraints as the other api/* helpers: no direct DB access,
// one Edge Function per call, errors unwrapped by invokeEF.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// venue_members.role DB enum — per-venue tier (distinct from the
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

type TeamWaiter = {
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

type PendingWaiterInvite = {
  id: string;
  phone: string | null;
  channel: "whatsapp" | "sms";
  token: string;
  createdAt: string;
  expiresAt: string;
};

// `super_admin` is a synthetic role for users in public.super_admins
// who aren't in venue_members for this venue; the EF still grants them
// owner-level UI affordances.
type CallerRole = BusinessRole | "staff" | "super_admin";

// Note on field naming: the EF returns `businesses` / `pendingBusinessInvites`
// because those rows are joined from the `businesses` (platform-account)
// table. The team UI labels them as "Editors" — that's the per-venue tier
// (member_role) name, distinct from the source table name.
export type TeamSnapshot = {
  myRole: CallerRole | null;
  businesses: TeamEditor[];
  waiters: TeamWaiter[];
  pendingBusinessInvites: PendingEditorInvite[];
  pendingWaiterInvites: PendingWaiterInvite[];
};

export async function apiListTeam(
  client: SupabaseClient,
  venueId: string,
): Promise<TeamSnapshot> {
  return await invokeEF<TeamSnapshot>(client, "business-list-team", {
    venueId,
  });
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
    venueId: string;
    email: string;
    role: BusinessRole;
    redirectBase?: string;
  },
): Promise<InviteEditorResult> {
  return await invokeEF<InviteEditorResult>(
    client,
    "business-invite-business",
    input,
  );
}

type InviteWaiterResult = {
  inviteId: string;
  token: string;
  phone: string | null;
  channel: "whatsapp" | "sms";
  expiresAt: string;
  shareUrl: string | null;
  sent: boolean;
};

export async function apiInviteWaiter(
  client: SupabaseClient,
  input: {
    venueId: string;
    channel: "whatsapp" | "sms";
    phone?: string;
    redirectBase?: string;
  },
): Promise<InviteWaiterResult> {
  return await invokeEF<InviteWaiterResult>(
    client,
    "business-invite-waiter",
    input,
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
  );
}

export type RemoveKind = "editor" | "waiter" | "editorInvite" | "waiterInvite";

export async function apiRemoveMember(
  client: SupabaseClient,
  input: { id: string; kind: RemoveKind },
): Promise<{ id: string; kind: RemoveKind }> {
  return await invokeEF<{ id: string; kind: RemoveKind }>(
    client,
    "business-remove-member",
    input,
  );
}

export type TestWaiterChannelResult = {
  channel: "whatsapp" | "sms";
  to: string;
  sent: boolean;
  mock: boolean;
  note: string;
};

export async function apiTestWaiterChannel(
  client: SupabaseClient,
  input: { venueId: string; channel: "whatsapp" | "sms"; phone: string },
): Promise<TestWaiterChannelResult> {
  return await invokeEF<TestWaiterChannelResult>(
    client,
    "business-test-waiter-channel",
    input,
  );
}

export async function apiAcceptEditorInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ venueId: string; role: BusinessRole }> {
  return await invokeEF<{ venueId: string; role: BusinessRole }>(
    client,
    "business-accept-invite",
    { token },
  );
}
