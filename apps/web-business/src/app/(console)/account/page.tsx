import { getIdentityCached } from "@/lib/identity";
import { PageHeader } from "@/components/shell/Page";
import { AccountCard } from "@/components/shell/AccountCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

// The account (MESITA-3123): one person's Google sign-in. Places and accounts
// are the only layers; each place's team lives in that place's Settings.
export default async function AccountPage() {
  const identity = await getIdentityCached();
  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-8">
      <PageHeader title="Account" />
      <AccountCard email={identity.ok ? identity.data.email : null} />
    </div>
  );
}
