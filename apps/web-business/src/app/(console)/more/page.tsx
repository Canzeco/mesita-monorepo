import { getIdentityCached } from "@/lib/identity";
import { MoreList } from "@/components/shell/BusinessShell";
import { PageHeader } from "@/components/shell/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "More" };

export default async function MorePage() {
  const identity = await getIdentityCached();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="More" />
      <MoreList isSuperAdmin={identity.ok && identity.data.isSuperAdmin} />
    </div>
  );
}
