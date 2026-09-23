import { FavoritesTab } from "@/components/home/FavoritesTab";
import { HOME_RAIL, TabFrame } from "@/components/ui/TabRail";

// Visit › Favs (MESITA-2050) — web's /discover/favs. Saves are device-local.
export default function FavsScreen() {
  return (
    <TabFrame items={HOME_RAIL} value="favs">
      <FavoritesTab />
    </TabFrame>
  );
}
