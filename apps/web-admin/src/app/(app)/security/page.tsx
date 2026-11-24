import { PageContainer, PageHeader } from "@/components/admin-ui";
import { listSecurity } from "./actions";
import { SecurityClient } from "./SecurityClient";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const res = await listSecurity();
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Security" description="Wrong waiter codes: what closes a ticket, what suspends a guest, and who is suspended." />
      <SecurityClient initial={res.ok ? res : null} loadError={res.ok ? null : res.error} />
    </PageContainer>
  );
}
