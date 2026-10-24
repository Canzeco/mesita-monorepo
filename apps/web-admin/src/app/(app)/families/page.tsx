import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const map = await getFamiliesMap();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations · Atlas"
        title="Atlas"
        description="One place has one Google category, the Places primary type. A category can sit in one guest family or several. The twenty families are always on. The table is that join, loaded from the catalog. Mesita Tags are below. Places are not listed."
      />
      {map.ok ? (
        <FamiliesExplorer map={map} />
      ) : (
        <p className="text-destructive mt-8 text-sm">{map.error}</p>
      )}
    </PageContainer>
  );
}
