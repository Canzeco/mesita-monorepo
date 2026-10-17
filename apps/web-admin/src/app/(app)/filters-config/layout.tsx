import { PageContainer } from "@/components/PageContainer";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { DiscoveryChrome } from "./DiscoveryChrome";
import { DiscoveryPanels } from "./DiscoveryPanels";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { DiscoveryMatrixView } from "./matrix/page";
import { DiscoveryModesView } from "./modes/page";
import { DiscoverySignalsView } from "./signals/page";
import { SearchSourcesView } from "./sources/page";

// Discovery — four subpages under a frozen /filters-config prefix.
// Sources · Modes · Signals · Matrix. All four mount together.
export default async function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loaded = await getDiscoveryConfig();
  const seed: ConfigSeed<DiscoveryConfig> = {
    initialConfig: loaded.ok ? loaded.config : DEFAULT_CONFIG,
    initialUpdatedAt: loaded.ok ? loaded.updatedAt : null,
    loadError: loaded.ok ? null : loaded.error,
  };
  return (
    <PageContainer>
      <DiscoveryChrome />
      <div className="mt-6 sm:mt-8">
        <DiscoveryPanels
          sources={<SearchSourcesView seed={seed} />}
          modes={<DiscoveryModesView seed={seed} />}
          signals={<DiscoverySignalsView seed={seed} />}
          matrix={<DiscoveryMatrixView />}
        />
        {children}
      </div>
    </PageContainer>
  );
}
