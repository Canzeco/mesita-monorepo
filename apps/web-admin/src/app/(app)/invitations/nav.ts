import { DoorOpen } from "lucide-react";

// The Diamond List — the admin side of the invitation (MESITA-972,
// MESITA-1160, MESITA-2044). Not a Configuration: nothing here is a policy
// blob. It adds a guest to the list or removes them, by writing one guest's
// `consumers.invitation_class_key`. Unlisted from the rail since MESITA-1783;
// the page still lives at /invitations (a label never moves a route).
export const INVITATIONS_PARENT = {
  href: "/invitations",
  label: "Diamond List",
  Icon: DoorOpen,
} as const;
