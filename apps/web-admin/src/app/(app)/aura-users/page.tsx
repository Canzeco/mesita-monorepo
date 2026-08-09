import { listAura } from "./actions";
import { AuraUsersClient } from "./AuraUsersClient";

export const dynamic = "force-dynamic";

export default async function AuraUsersPage() {
  const res = await listAura();
  return (
    <AuraUsersClient
      initialMembers={res.ok ? res.members : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
