import { listAura } from "./actions";
import { AuraConfigClient } from "./AuraConfigClient";

export const dynamic = "force-dynamic";

export default async function AuraConfigPage() {
  const res = await listAura();
  return (
    <AuraConfigClient
      initialMembers={res.ok ? res.members : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
