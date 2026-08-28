import { ConfigSection } from "@/components/admin-ui";
import { CatalogConfigClient } from "./CatalogConfigClient";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { FavsConfigCard } from "./DiscoverySurfaceCards";
import { GeneralConfigClient } from "./GeneralConfigClient";
import { MapConfigClient } from "./MapConfigClient";
import { NameConfigClient } from "./NameConfigClient";
import { SignalsConfigClient } from "./SignalsConfigClient";
import { SocialConfigClient } from "./SocialConfigClient";
import { SwipeConfigClient } from "./SwipeConfigClient";
import { getDiscoveryConfig } from "./actions";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery is two sections. Search Modes = ways guests look.
// Search Modules = shared parameters and the Signals library.
// Modes: Name (Fast) · Name (Deep) · Map · Swipe · Catalog · Chat ·
// Social · Favorites. Modules: General · Signals.
// Home boxes (Swipe · Catalog · Chat · Social · Favorites) are Soon.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-16">
      <ConfigSection
        id="search-modes"
        title="Search Modes"
        subtitle="Ways guests look. Each box is one mode."
      >
        <NameConfigClient
          initialConfig={initialConfig}
          initialUpdatedAt={initialUpdatedAt}
          loadError={loadError}
        />
        <MapConfigClient
          initialConfig={initialConfig}
          initialUpdatedAt={initialUpdatedAt}
          loadError={loadError}
        />
        <SwipeConfigClient />
        <CatalogConfigClient />
        <DiscoveryConfigClient />
        <SocialConfigClient />
        <FavsConfigCard />
      </ConfigSection>
      <ConfigSection
        id="search-modules"
        title="Search Modules"
        subtitle="Shared parameters and scores. Modes read this library; they do not invent a second scale."
      >
        <GeneralConfigClient
          initialConfig={initialConfig}
          initialUpdatedAt={initialUpdatedAt}
          loadError={loadError}
        />
        <SignalsConfigClient
          initialConfig={initialConfig}
          initialUpdatedAt={initialUpdatedAt}
          loadError={loadError}
        />
      </ConfigSection>
    </div>
  );
}
