import { listGuests } from "./actions";
import { GuestsClient } from "./GuestsClient";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const res = await listGuests();
  return (
    <GuestsClient
      initialGuests={res.ok ? res.guests : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
