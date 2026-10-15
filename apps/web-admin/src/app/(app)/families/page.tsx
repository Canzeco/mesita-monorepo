import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getDiscoveryConfig } from "@/app/(app)/filters-config/actions";
import { DEFAULT_CONFIG } from "@/app/(app)/filters-config/catalog";
import { FamiliesClient } from "@/app/(app)/filters-config/FamiliesClient";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const [map, discovery] = await Promise.all([getFamiliesMap(), getDiscoveryConfig()]);
  const initialConfig = discovery.ok ? discovery.config : DEFAULT_CONFIG;
  const initialUpdatedAt = discovery.ok ? discovery.updatedAt : null;
  const loadError = discovery.ok ? null : discovery.error;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations · Atlas"
        title="Atlas"
        description="Categories are Google's. Each one has one emoji. A place has that category and no family. Tags list the whole catalog."
      />
      <div className="mt-8">
        <FamiliesClient
          initialConfig={initialConfig}
          initialUpdatedAt={initialUpdatedAt}
          loadError={loadError}
        />
      </div>
      {map.ok ? (
        <FamiliesExplorer map={map} />
      ) : (
        <p className="text-destructive mt-8 text-sm">{map.error}</p>
      )}
    </PageContainer>
  );
}
