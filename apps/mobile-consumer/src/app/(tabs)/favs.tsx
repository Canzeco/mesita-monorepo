import { FavoritesTab } from '@/components/home/FavoritesTab';
import { TabFrame, VISIT_RAIL } from '@/components/ui/TabRail';

// Visit › Favs (MESITA-2050) — web's /discover/favs. Saves are device-local.
export default function FavsScreen() {
  return (
    <TabFrame items={VISIT_RAIL} value="favs">
      <FavoritesTab />
    </TabFrame>
  );
}
