import { Database } from "lucide-react";

// The first entry of the Manage section — the backend itself, above the units
// and consumers stored in it. Home for database-wide operator actions; today
// the reset-environment tool (moved out of Admins 2026-07-26, then out of
// Configs 2026-08-09). Nothing here is a policy blob: these are live writes
// against the singleton backend.
export const DB_PARENT = {
  href: "/manage-database",
  label: "Database",
  Icon: Database,
} as const;
