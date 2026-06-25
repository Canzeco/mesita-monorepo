import { PageContainer, PageHeader } from "@/components/PageContainer";
import { SingleUnitConsole } from "./SingleUnitConsole";

export const dynamic = "force-dynamic";

export default function ManageSingleUnitPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Units · Single"
        title="Manage Single Unit"
        description="Search any venue and run it end-to-end — Place, Promos, Scan, Performance, Team. Edits write straight to the venue through the business edge functions; your super-admin access bypasses membership."
      />
      <SingleUnitConsole />
    </PageContainer>
  );
}
