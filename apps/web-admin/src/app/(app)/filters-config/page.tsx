import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { AreaBox, DeepBox, NameAdminBox, NameBox } from "./PipelineBoxes";

// Discovery: ONE page, no subpages (MESITA-2327). Four boxes, one per
// pipeline as it is run: Admin Name · Consumer Name · Consumer Area ·
// Consumer Deep (MESITA-2779).
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
      description="Four sources, four pipelines, five signals, two gates. Every Discovery control is on this page; family membership lives on Atlas."
    >
      <div className="flex flex-col gap-6">
        <NameAdminBox {...seed} />
        <NameBox {...seed} />
        <AreaBox {...seed} />
        <DeepBox />
      </div>
    </ConfigPageLayout>
  );
}
