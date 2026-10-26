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
        description="Each Google category maps to a list of families: one, several or none, never a primary and a secondary. A place sits in every family of its categories. The twenty families are always on. The table is that join, loaded from the catalog. Mesita Tags are below. Places are not listed."
      />
      {map.ok ? (
        <FamiliesExplorer map={map} />
      ) : (
        <p className="text-destructive mt-8 text-sm">{map.error}</p>
      )}
    </PageContainer>
  );
}
