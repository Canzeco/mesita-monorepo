import type { BusinessRole } from "@/lib/api/team";

// member_role enum values, surfaced as "Owner / Editor / Viewer" on
// the Team page. Migration 0025 swapped legacy 'manager' -> 'editor'.
export const ROLE_LABEL: Record<BusinessRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_CHOICES: BusinessRole[] = ["owner", "editor", "viewer"];
export const MANAGER_ROLE_CHOICES: BusinessRole[] = ["owner", "editor"];

export type InviteOpen = null | "manager";
