import { Cpu } from "lucide-react";

// One sidebar entry — "Models Config". The single place to pick which AI model
// each subsystem uses (Supabase EFs · Enricher · Lineup · Memo). A single flat
// page, no sub-tabs. Sits directly above Atlas Config in the Configs group.
export const MODELS_PARENT = {
  href: "/models-config",
  label: "Models Config",
  Icon: Cpu,
} as const;
