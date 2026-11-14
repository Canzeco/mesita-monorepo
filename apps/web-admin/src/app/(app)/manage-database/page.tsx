import { PageContainer, PageHeader } from "@/components/admin-ui";
import { ManageDatabaseClient } from "./ManageDatabaseClient";

export default function ManageDatabasePage() {
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Database"
        description="Database-wide operator actions. Handle with care — these run against the live singleton backend. Super-admins only."
      />
      <ManageDatabaseClient />
    </PageContainer>
  );
}
