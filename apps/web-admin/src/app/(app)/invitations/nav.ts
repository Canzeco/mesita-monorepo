import { DoorOpen } from "lucide-react";

// Invitations — the admin side of the INVITATION DOOR (MESITA-972,
// MESITA-1160). Not a Configuration: nothing here is a policy blob. It writes
// one guest's `consumers.invitation_class_key` and lets the shared recompute
// settle their slot. Unlisted from the rail since MESITA-1783; the page
// still lives at /invitations.
export const INVITATIONS_PARENT = {
  href: "/invitations",
  label: "Invitations",
  Icon: DoorOpen,
} as const;
