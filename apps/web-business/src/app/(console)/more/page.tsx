import { getIdentityCached } from "@/lib/identity";
import { MoreList } from "@/components/shell/BusinessShell";
import { PageHeader } from "@/components/shell/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "More" };

export default async function MorePage() {
  const identity = await getIdentityCached();
  const places = identity.ok
    ? identity.data.places.filter((p) => p.state === "owner").map((p) => ({ id: p.place_id, name: p.name, photo: p.photo }))
    : [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="More" />
      <MoreList places={places} isSuperAdmin={identity.ok && identity.data.isSuperAdmin} email={identity.ok ? identity.data.email : null} />
    </div>
  );
}
