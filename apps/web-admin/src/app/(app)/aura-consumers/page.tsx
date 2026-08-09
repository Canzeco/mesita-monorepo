import { listAura } from "./actions";
import { AuraConsumersClient } from "./AuraConsumersClient";

export const dynamic = "force-dynamic";

export default async function AuraConsumersPage() {
  const res = await listAura();
  return (
    <AuraConsumersClient
      initialMembers={res.ok ? res.members : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
