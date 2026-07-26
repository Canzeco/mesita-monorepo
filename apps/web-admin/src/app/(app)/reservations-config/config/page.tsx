import { getReservationsConfig } from "../actions";
import { ReservationsConfigClient } from "../ReservationsConfigClient";
import { DEFAULT_CONFIG } from "../catalog";

// Reservations Config · Config — the Reservationist knobs. Server-seeds the
// live row and passes loadError so a failed load can't be saved over.
export const dynamic = "force-dynamic";

export default async function ReservationsConfigPage() {
  const res = await getReservationsConfig();
  return (
    <ReservationsConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
