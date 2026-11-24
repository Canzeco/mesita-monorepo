import { PageContainer, PageHeader } from "@/components/admin-ui";
import { listVip } from "./actions";
import { VipClient } from "./VipClient";

export const dynamic = "force-dynamic";

export default async function VipPage() {
  const res = await listVip();
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="VIP"
        description="Invitation codes and every VIP guest. A guest is VIP by a code you issue. Instagram followers do not count until the DM bot proves who owns the account."
      />
      <VipClient
        initialCodes={res.ok ? res.codes : null}
        initialGuests={res.ok ? res.guests : null}
        loadError={res.ok ? null : res.error}
      />
    </PageContainer>
  );
}
