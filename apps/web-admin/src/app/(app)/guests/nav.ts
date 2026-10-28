import { UsersRound } from "lucide-react";

// Manage › Guests (MESITA-2550) — find a guest, then
// set Class (Regular or VIP) and Plan (Free or Pro), MESITA-2553. Right after
// Admins: both rows are people.
export const GUESTS_PARENT = {
  href: "/guests",
  label: "Guests",
  Icon: UsersRound,
} as const;
