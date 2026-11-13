import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { LayoutGrid, MapPin, ScanSearch, Search } from "lucide-react";
import { DiscoveryOverview, rankedBy } from "./PipelineBox";
import { CatalogBox, MapBox, NameAdminBox, NameBox } from "./PipelineBoxes";

const ICON = "h-4 w-4";

// The first card (MESITA-3819): one row per box, a jump to each.
const OVERVIEW = [
  { href: "#s-name-admin", icon: <ScanSearch className={ICON} />, title: "Admin & Business Searchbar", who: "Admin Single Place › Find · Business › Places", ranked: "Found by both first" },
  { href: "#s-name", icon: <Search className={ICON} />, title: "Consumer Searchbar", who: "The guest's Search bar", ranked: rankedBy("name") },
  { href: "#s-map", icon: <MapPin className={ICON} />, title: "Consumer Map", who: "The Search tab's pins", ranked: rankedBy("map") },
  { href: "#s-catalog", icon: <LayoutGrid className={ICON} />, title: "Consumer Catalog", who: "Home's Places · Chat", ranked: rankedBy("catalog") },
];

// Discovery: ONE page, no subpages (MESITA-2327). Four boxes, one per live
// pipeline: Admin Name · Consumer Name · Consumer Map · Consumer Catalog
// (MESITA-2779, MESITA-2909). Consumer Deep (Soon) and Premier Prices left
// the page (MESITA-3828); their stored settings stay on the config blob.
export default async function DiscoveryPage() {
  const loaded = await getDiscoveryConfig();
  const seed: ConfigSeed<DiscoveryConfig> = {
    initialConfig: loaded.ok ? loaded.config : DEFAULT_CONFIG,
    initialUpdatedAt: loaded.ok ? loaded.updatedAt : null,
    loadError: loaded.ok ? null : loaded.error,
  };
  return (
    <ConfigPageLayout
      title="Discovery"
      description="How every place search in Mesita finds and ranks places. Each box shows its settings first; open How it works for the full rules. Family membership lives on Atlas."
    >
      <div className="flex flex-col gap-6">
        <DiscoveryOverview rows={OVERVIEW} />
        <NameAdminBox {...seed} />
        <NameBox {...seed} />
        <MapBox {...seed} />
        <CatalogBox {...seed} />
      </div>
    </ConfigPageLayout>
  );
}
