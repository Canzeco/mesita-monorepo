import { Zap } from "lucide-react";

// Manage › Premier (MESITA-3011) — every place's paid visibility on one
// page: which places are Premier, who pays or what was granted, the line,
// and what Premier charged. After Single Place: one place's Premier is
// still its own tab there (/manage-single/<id>/boost).
export const PREMIER_PARENT = {
  href: "/premier",
  label: "Premier",
  Icon: Zap,
} as const;
