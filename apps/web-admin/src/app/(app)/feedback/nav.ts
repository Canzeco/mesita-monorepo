import { MessageSquareWarning } from "lucide-react";

// Activity › Feedback (MESITA-3024, moved from Manage by MESITA-3034) — every
// guest report, from every place, newest first. Read-only: a log, like Logs
// and Analytics beside it.
export const FEEDBACK_PARENT = {
  href: "/feedback",
  label: "Feedback",
  Icon: MessageSquareWarning,
} as const;
