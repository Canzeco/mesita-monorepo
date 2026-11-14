import { ConfigPageLayout } from "@/components/admin-ui";
import { getReservationsConfig } from "./actions";
import { ReservationsConfigClient } from "./ReservationsConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Reservations — one page, ONE box: Testing (plus Needs Attention when
// non-empty). MESITA-2122 cut the Calls card (kill switch, caps, reminder,
// enrich override) and the fleet strip; those knobs live on in the stored row.
export const dynamic = "force-dynamic";

export default async function ReservationsConfigPage() {
  const res = await getReservationsConfig();
  return (
    <ConfigPageLayout
      title="Reservations"
      description="The voice agent books tables by phone. Keep it on the test number until a real run."
    >
      <ReservationsConfigClient
        initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
        initialNeedsAttention={res.ok ? res.needsAttention : []}
        loadError={res.ok ? null : res.error}
      />
    </ConfigPageLayout>
  );
}
