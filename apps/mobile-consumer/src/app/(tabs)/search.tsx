import { SearchClient } from '@/components/search/SearchClient';
import { TabFrame, VISIT_RAIL } from '@/components/ui/TabRail';

// Visit › Search (MESITA-2050) — the map, under Visit's rail. The rail band
// owns the top safe area, so SearchClient's floating bar sits 8pt below the
// rail instead of below the status bar.
export default function SearchScreen() {
  return (
    <TabFrame items={VISIT_RAIL} value="search">
      <SearchClient topInset={0} />
    </TabFrame>
  );
}
