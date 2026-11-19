import { ConfigPageLayout } from "@/components/admin-ui";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import {
  DiscoverySaveScope,
  HowRankedCard,
  MapDisplayBox,
  MixingBox,
  NameAdminBox,
  NameBox,
  RankingBox,
} from "./PipelineBoxes";

// Discovery: ONE page, no subpages (MESITA-2327). Five cards since
// MESITA-4454: How places are ranked (read only) · Ranking · Mixing · Map
// display · Searchbars (the Consumer and the Admin & Business boxes).
// Consumer Deep (Soon) and Premier Prices left the page (MESITA-3828); their
// stored settings stay on the config blob.
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
      description="How every place search in Mesita finds and ranks places. Each card saves only its own settings. Family membership lives on Atlas."
    >
      <DiscoverySaveScope initialUpdatedAt={seed.initialUpdatedAt}>
        <div className="flex flex-col gap-6">
          <HowRankedCard />
          <RankingBox {...seed} />
          <MixingBox {...seed} />
          <MapDisplayBox {...seed} />
          <p className="text-muted-foreground type-eyebrow -mb-3">Searchbars</p>
          <NameBox {...seed} />
          <NameAdminBox {...seed} />
        </div>
      </DiscoverySaveScope>
    </ConfigPageLayout>
  );
}
