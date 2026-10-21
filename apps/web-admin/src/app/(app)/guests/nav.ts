import { UsersRound } from "lucide-react";

// Manage › Guests (MESITA-2550) — find a guest, then grant or take away
// Diamond and set the plan, Free or Premium (MESITA-2548). Right after
// Admins: both rows are people.
export const GUESTS_PARENT = {
  href: "/guests",
  label: "Guests",
  Icon: UsersRound,
} as const;
