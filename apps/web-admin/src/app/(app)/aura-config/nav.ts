import { Sparkles } from "lucide-react";

// One sidebar entry — "Aura Config". The roster of the invite-only Aura class
// (segments v6, MESITA-797): who is in, and the two writes that change it.
// A single flat page, no sub-tabs. The rates Aura earns live in Rewards Config.
export const AURA_PARENT = {
  href: "/aura-config",
  label: "Aura Config",
  Icon: Sparkles,
} as const;
