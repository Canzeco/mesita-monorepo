import { Cpu } from "lucide-react";

// One sidebar entry — "Models Config". The single place to pick which AI model
// each subsystem uses (Supabase EFs · Intaker · Embeddings · Memo). A single flat
// page, no sub-tabs. Sits in the platform pair at the top of the Configs group
// (under Admins), since every config below it inherits these models.
export const MODELS_PARENT = {
  href: "/models-config",
  label: "Models",
  Icon: Cpu,
} as const;
