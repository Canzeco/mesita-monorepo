import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const map = await getFamiliesMap();
  return (
    <PageContainer>
      <PageHeader
        title="Atlas"
        description="The thirty-seven Mesita Families, Google's categories split into enabled and not enabled on Mesita, and the Mesita Tags. A place's families are inferred by the Description step, one to seven, or set by hand on Single Place › Basics. Places are not listed."
      />
      <div className="mt-6 sm:mt-8">
        {map.ok ? (
          <FamiliesExplorer map={map} />
        ) : (
          <p className="text-destructive text-sm">{map.error}</p>
        )}
      </div>
    </PageContainer>
  );
}
