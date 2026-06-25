import {
  Eye,
  Images,
  LayoutList,
  Link2,
  Star,
} from "lucide-react";
import type { SubTabItem } from "@/components/business/SubTabs";

export type PlaceSubTab =
  | "basics"
  | "media"
  | "channels"
  | "reviews"
  | "preview";

export const PLACE_SUB_TABS: readonly SubTabItem<PlaceSubTab>[] = [
  { id: "preview", label: "Preview", Icon: Eye },
  { id: "basics", label: "Basics", Icon: LayoutList },
  { id: "media", label: "Media", Icon: Images },
  { id: "channels", label: "Channels", Icon: Link2 },
  { id: "reviews", label: "Reviews", Icon: Star },
];

const PLACE_SUB_TAB_IDS = new Set<string>(PLACE_SUB_TABS.map((tab) => tab.id));

const PLACE_SUB_TAB_ALIASES: Record<string, PlaceSubTab> = {
  photos: "media",
  menu: "media",
};

export function resolvePlaceSubTab(value: string | null): PlaceSubTab {
  if (value && PLACE_SUB_TAB_IDS.has(value)) {
    return value as PlaceSubTab;
  }
  if (value && value in PLACE_SUB_TAB_ALIASES) {
    return PLACE_SUB_TAB_ALIASES[value];
  }
  return "preview";
}

export function isPlaceSubTab(value: string | null): value is PlaceSubTab {
  return value != null && PLACE_SUB_TAB_IDS.has(value);
}
