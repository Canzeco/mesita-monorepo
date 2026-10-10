import { CatalogTab } from "@/components/home/CatalogTab";
import { HOME_RAIL, TabFrame } from "@/components/ui/TabRail";

// Home › Home (MESITA-2081) — web's /discover/feed. Web renders CatalogRails
// there; mobile has no rails port yet, so it mounts CatalogTab, the browse
// grid over the same shared deck query. Same job: browse, no verdict. The
// deck moved one pill over, to Scroll.
export default function HomeScreen() {
  return (
    <TabFrame items={HOME_RAIL} value="home">
      <CatalogTab />
    </TabFrame>
  );
}
