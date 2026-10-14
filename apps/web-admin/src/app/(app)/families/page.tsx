import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const map = await getFamiliesMap();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Manage"
        title="Families"
        description="Google Place Categories, Mesita Families, and Mesita Categories. Read-only. Selecting any row highlights what it maps to. A category may belong to two families. A Google type maps to one family, or to Other."
      />
      {map.ok ? (
        <FamiliesExplorer map={map} />
      ) : (
        <p className="text-destructive mt-8 text-sm">{map.error}</p>
      )}
    </PageContainer>
  );
}
