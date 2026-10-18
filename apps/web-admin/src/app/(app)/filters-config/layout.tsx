import { PageContainer } from "@/components/PageContainer";
import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { DiscoveryChrome } from "./DiscoveryChrome";
import { DiscoveryPanels } from "./DiscoveryPanels";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { DiscoveryModesView } from "./modes/page";
import { DiscoverySignalsView } from "./signals/page";

// Discovery — two subpages under a frozen /filters-config prefix
// (MESITA-2303): Modes · Signals. Both mount together.
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
          modes={<DiscoveryModesView seed={seed} />}
          signals={<DiscoverySignalsView seed={seed} />}
        />
        {children}
      </div>
    </PageContainer>
  );
}
