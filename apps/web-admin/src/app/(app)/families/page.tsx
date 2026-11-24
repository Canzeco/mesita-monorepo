import { ConfigPageLayout, Notice } from "@/components/admin-ui";
import { getFamiliesMap } from "./actions";
import { FamiliesExplorer } from "./FamiliesExplorer";
import { FieldLimitsCard } from "./FieldLimitsCard";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const map = await getFamiliesMap();
  return (
    <ConfigPageLayout
      title="Atlas"
      description="The twenty-five Mesita Families, the Google categories Mesita allows, and the Mesita Tags. A place's families are inferred by the Description step, within the Limits below, or set by hand in the Business app. Places are not listed."
    >
      {map.ok ? (
        <div className="flex flex-col gap-4">
          {map.limits && <FieldLimitsCard limits={map.limits} />}
          <FamiliesExplorer map={map} />
        </div>
      ) : (
        <Notice>{map.error}</Notice>
      )}
    </ConfigPageLayout>
  );
}
