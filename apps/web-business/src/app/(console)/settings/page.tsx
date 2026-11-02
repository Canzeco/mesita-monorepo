import { getIdentityCached } from "@/lib/identity";
import { AccountCard } from "@/components/shell/AccountCard";
import { PageHeader } from "@/components/shell/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const identity = await getIdentityCached();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <AccountCard phone={identity.ok ? identity.data.phone : null} email={identity.ok ? identity.data.email : null} />
    </div>
  );
}
