import { DoorOpen } from "lucide-react";

// Invitations — the admin side of the INVITATION DOOR (MESITA-972,
// MESITA-1160). Not a Configuration: nothing here is a policy blob. It writes
// one guest's `consumers.invitation_class_key` and lets the shared recompute
// settle their slot. It sits in Manage, after the places, because it is the
// one record in this console that belongs to a guest rather than a venue.
export const INVITATIONS_PARENT = {
  href: "/invitations",
  label: "Invitations",
  Icon: DoorOpen,
} as const;
