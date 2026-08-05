import type { BusinessRole } from "@/lib/api/team";

// member_role enum — Owner / Editor / Viewer (MESITA-919). Exactly one
// owner per place; invites are editor|viewer only.
export const ROLE_LABEL: Record<BusinessRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_CHOICES: BusinessRole[] = ["owner", "editor", "viewer"];
/** Invite never creates an owner — transfer from Team instead. */
export const INVITE_ROLE_CHOICES: BusinessRole[] = ["editor", "viewer"];

export type InviteOpen = null | "member";
