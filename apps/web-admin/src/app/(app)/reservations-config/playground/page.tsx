import { getReservationsConfig } from "../actions";
import { ReservationsPlaygroundClient } from "../ReservationsPlaygroundClient";
import { DEFAULT_CONFIG } from "../catalog";

// Reservations Config · Playground — a dry-run brief preview. Seeds the saved
// config so the resolved dial target reflects the live test-mode setting.
export const dynamic = "force-dynamic";

export default async function ReservationsPlaygroundPage() {
  const res = await getReservationsConfig();
  return (
    <ReservationsPlaygroundClient
      config={res.ok ? res.config : DEFAULT_CONFIG}
      loadError={res.ok ? null : res.error}
    />
  );
}
