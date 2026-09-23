import { DoorOpen } from "lucide-react";

// Diamond — the admin side of the invitation (MESITA-972,
// MESITA-1160, MESITA-2044). Not a Configuration: nothing here is a policy
// blob. It makes a guest Diamond or takes it away, by writing one guest's
// `consumers.invitation_class_key`. Unlisted from the rail since MESITA-1783;
// the page still lives at /invitations (a label never moves a route).
export const INVITATIONS_PARENT = {
  href: "/invitations",
  label: "Diamond",
  Icon: DoorOpen,
} as const;
