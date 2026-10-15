import { ScrollText } from "lucide-react";

// Logs — the second page under Testing. It reads the enrichment workflow's
// recent lines. LOGS_PARENT is the Sidebar entry.
export const LOGS_PARENT = {
  href: "/logs",
  label: "Logs",
  Icon: ScrollText,
} as const;
