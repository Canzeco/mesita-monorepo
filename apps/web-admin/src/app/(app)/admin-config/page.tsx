import { PageContainer, PageHeader } from "@/components/admin-ui";
import { listAdmins } from "./actions";
import { AdminConfigClient } from "./AdminConfigClient";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const res = await listAdmins();
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Admins"
        description="Manage who has admin access. Super-admins only."
      />
      <AdminConfigClient
        initialAdmins={res.ok ? res.admins : []}
        self={res.ok ? res.self : null}
        loadError={res.ok ? null : res.error}
      />
    </PageContainer>
  );
}
