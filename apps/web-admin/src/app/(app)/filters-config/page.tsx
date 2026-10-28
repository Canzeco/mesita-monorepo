import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { CatalogBox, DeepBox, MapBox, NameAdminBox, NameBox } from "./PipelineBoxes";

// Discovery: ONE page, no subpages (MESITA-2327). Five boxes, one per
// pipeline as it is run: Admin Name · Consumer Name · Consumer Map ·
// Consumer Catalog · Consumer Deep (MESITA-2779, MESITA-2909).
export default async function DiscoveryPage() {
  const loaded = await getDiscoveryConfig();
  const seed: ConfigSeed<DiscoveryConfig> = {
    initialConfig: loaded.ok ? loaded.config : DEFAULT_CONFIG,
    initialUpdatedAt: loaded.ok ? loaded.updatedAt : null,
    loadError: loaded.ok ? null : loaded.error,
  };
  return (
    <ConfigPageLayout
      eyebrow="Product · Discovery"
      title="Discovery"
      description="Four sources, five pipelines, three signals, two gates. Every Discovery control is on this page; family membership lives on Atlas."
    >
      <div className="flex flex-col gap-6">
        <NameAdminBox {...seed} />
        <NameBox {...seed} />
        <MapBox {...seed} />
        <CatalogBox {...seed} />
        <DeepBox />
      </div>
    </ConfigPageLayout>
  );
}
