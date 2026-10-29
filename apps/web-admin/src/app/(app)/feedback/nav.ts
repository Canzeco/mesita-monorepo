import { MessageSquareWarning } from "lucide-react";

// Manage › Feedback (MESITA-3024) — every guest report, from every place,
// newest first. Read-only. Right after Guests: both rows are about guests.
export const FEEDBACK_PARENT = {
  href: "/feedback",
  label: "Feedback",
  Icon: MessageSquareWarning,
} as const;
