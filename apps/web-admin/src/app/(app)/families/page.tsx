import { ConfigPageLayout, Notice } from "@/components/admin-ui";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const map = await getFamiliesMap();
  return (
    <ConfigPageLayout
      title="Atlas"
      description="The thirty Mesita Families, Google's categories split into enabled and not enabled on Mesita, and the Mesita Tags. A place's families are inferred by the Description step, one to seven, or set by hand on Single Place › Basics. Places are not listed."
    >
      {map.ok ? <FamiliesExplorer map={map} /> : <Notice>{map.error}</Notice>}
    </ConfigPageLayout>
  );
}
