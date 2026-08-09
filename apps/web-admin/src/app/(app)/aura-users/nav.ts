import { Sparkles } from "lucide-react";

// One sidebar entry — "Aura Users", the first page of the Users section. The
// roster of the invite-only Aura class (segments v6, MESITA-797): who is in,
// and the two writes that change it. A single flat page, no sub-tabs. This is
// people, not policy — the rates Aura earns live in Rewards Config.
export const AURA_USERS_PARENT = {
  href: "/aura-users",
  label: "Aura Users",
  Icon: Sparkles,
} as const;
