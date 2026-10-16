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
        description="The switches decide which of the twenty families Google search asks for. Below: counts, then Categories, Tags, and Families. A category can sit on more than one family. A precise rail is not also the broader one. Places are not listed."
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
