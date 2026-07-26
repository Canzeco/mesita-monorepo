import { Database } from "lucide-react";

// One sidebar entry — "DB Config". Home for database-wide operator actions;
// today the reset-environment tool (moved here from Admin Config 2026-07-26).
export const DB_PARENT = {
  href: "/db-config",
  label: "DB Config",
  Icon: Database,
} as const;
