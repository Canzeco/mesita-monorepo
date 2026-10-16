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
        description="The switches decide which of the fifteen guest families Google search asks for. Below: live counts, Tags, and the family rails loaded from the database. A place carries Google's primary type as its category; guest-family membership is derived from that type at read time and is not stored on the place. Places are not listed."
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
