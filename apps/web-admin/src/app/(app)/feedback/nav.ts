import { ChatCenteredTextIcon } from "@phosphor-icons/react/dist/ssr";

// Activity › Feedback (MESITA-3024, moved from Manage by MESITA-3034) — every
// guest report, from every place, newest first. Read-only: a log, like Logs
// beside it.
export const FEEDBACK_PARENT = {
  href: "/feedback",
  label: "Feedback",
  Icon: ChatCenteredTextIcon,
} as const;
