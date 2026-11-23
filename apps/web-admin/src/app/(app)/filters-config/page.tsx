import { ConfigPageLayout } from "@/components/admin-ui";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig } from "./actions";
import { JumpRow } from "./JumpRow";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import {
  DiscoverySaveScope,
  HowRankedCard,
  MapDisplayBox,
  MixingBox,
  RankingBox,
  ScoreOverlayBox,
  SearchbarsBox,
  SocialDiscoveryBox,
} from "./PipelineBoxes";

// Discovery: ONE page, no subpages (MESITA-2327). Numbers first since
// MESITA-4694 (Pato: "make it cleaner … simpler"): a pinned jump row, then
// the sections in the order the guest meets them: Home (Ranking, Mixing,
// Social, Score overlay), then Search (Map, Search bars), and last the explanation, closed.
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
      description="How Mesita finds and ranks places. Each section saves on its own."
    >
      <JumpRow />
      <DiscoverySaveScope initialUpdatedAt={seed.initialUpdatedAt}>
        <div className="flex flex-col gap-6">
          <RankingBox {...seed} />
          <MixingBox {...seed} />
          <SocialDiscoveryBox {...seed} />
          <ScoreOverlayBox {...seed} />
          <MapDisplayBox {...seed} />
          <SearchbarsBox {...seed} />
          <HowRankedCard />
        </div>
      </DiscoverySaveScope>
    </ConfigPageLayout>
  );
}
