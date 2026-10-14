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
        eyebrow="Operations · Families"
        title="Families"
        description="The switches decide which families Google search asks for. The map below is read-only. Selecting any row highlights what it maps to. A category may belong to two families. A Google type maps to one family. Types outside the seven land on Undefined."
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
