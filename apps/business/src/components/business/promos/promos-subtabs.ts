import { Crown, Instagram, Percent, Users } from "lucide-react";
import type { SubTabItem } from "@/components/business/SubTabs";

export type PromosSubTab = "plan" | "rates" | "instagram" | "guests";

export const PROMOS_SUB_TABS: readonly SubTabItem<PromosSubTab>[] = [
  { id: "plan", label: "Plan", Icon: Crown },
  { id: "rates", label: "Rates", Icon: Percent },
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "guests", label: "Guests", Icon: Users },
];

const PROMOS_SUB_TAB_IDS = new Set<string>(
  PROMOS_SUB_TABS.map((tab) => tab.id),
);

export function resolvePromosSubTab(value: string | null): PromosSubTab {
  if (value && PROMOS_SUB_TAB_IDS.has(value)) {
    return value as PromosSubTab;
  }
  return "plan";
}

export function isPromosSubTab(value: string | null): value is PromosSubTab {
  return value != null && PROMOS_SUB_TAB_IDS.has(value);
}
