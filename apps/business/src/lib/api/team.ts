// Frontend API surface for the Team page.
//
// Same constraints as the other api/* helpers: no direct DB access,
// one Edge Function per call, errors unwrapped by invokeEF.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type ManagerRole = "owner" | "manager" | "viewer";

export type TeamManager = {
  memberId: string;
  userId: string;
  role: ManagerRole | string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

export type TeamWaiter = {
  userId: string;
  phone: string | null;
  createdAt: string;
};

export type PendingManagerInvite = {
  id: string;
  email: string;
  role: ManagerRole | string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export type PendingWaiterInvite = {
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
export type CallerRole = ManagerRole | "staff" | "super_admin";

export type TeamSnapshot = {
  myRole: CallerRole | null;
  managers: TeamManager[];
  waiters: TeamWaiter[];
  pendingManagerInvites: PendingManagerInvite[];
  pendingWaiterInvites: PendingWaiterInvite[];
};

export async function apiListTeam(
  client: SupabaseClient,
  venueId: string,
): Promise<TeamSnapshot> {
  return await invokeEF<TeamSnapshot>(client, "manager-list-team", { venueId });
}

export type InviteManagerResult =
  | {
      mode: "linked";
      memberId: string;
      email: string;
      role: ManagerRole;
    }
  | {
      mode: "invited";
      inviteId: string;
      token: string;
      expiresAt: string;
      email: string;
      role: ManagerRole;
      emailSent: boolean;
      emailError: string | null;
    };

export async function apiInviteManager(
  client: SupabaseClient,
  input: {
    venueId: string;
    email: string;
    role: ManagerRole;
    redirectBase?: string;
  },
): Promise<InviteManagerResult> {
  return await invokeEF<InviteManagerResult>(
    client,
    "manager-invite-manager",
    input,
  );
}

export type InviteWaiterResult = {
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
    "manager-invite-waiter",
    input,
  );
}

export async function apiUpdateMemberRole(
  client: SupabaseClient,
  input: { memberId: string; role: ManagerRole },
): Promise<{ memberId: string; role: ManagerRole }> {
  return await invokeEF<{ memberId: string; role: ManagerRole }>(
    client,
    "manager-update-member-role",
    input,
  );
}

export type RemoveKind = "manager" | "waiter" | "mgrInvite" | "waiterInvite";

export async function apiRemoveMember(
  client: SupabaseClient,
  input: { id: string; kind: RemoveKind },
): Promise<{ id: string; kind: RemoveKind }> {
  return await invokeEF<{ id: string; kind: RemoveKind }>(
    client,
    "manager-remove-member",
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
    "manager-test-waiter-channel",
    input,
  );
}

export async function apiAcceptManagerInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ venueId: string; role: ManagerRole }> {
  return await invokeEF<{ venueId: string; role: ManagerRole }>(
    client,
    "manager-accept-invite",
    { token },
  );
}
