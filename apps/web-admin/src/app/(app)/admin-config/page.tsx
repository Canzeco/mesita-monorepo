import { listAdmins } from "./actions";
import { AdminConfigClient } from "./AdminConfigClient";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const res = await listAdmins();
  return (
    <AdminConfigClient
      initialAdmins={res.ok ? res.admins : []}
      self={res.ok ? res.self : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
