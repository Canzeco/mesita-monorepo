import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getReservationsConfig } from "./actions";
import { ReservationsConfigClient } from "./ReservationsConfigClient";
import { DEFAULT_CONFIG } from "./catalog";
import { FleetStrip } from "./FleetStrip";

// Reservations Config — one page, no tabs. TWO boxes. Fleet strip names a1–a4.
export const dynamic = "force-dynamic";

export default async function ReservationsConfigPage() {
  const res = await getReservationsConfig();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations · Reservations"
        title="Reservations Config"
        description="Four voice agents book tables and keep both sides honest. Tune what they may dial."
      />
      <FleetStrip />
      <div className="mt-6 sm:mt-8">
        <ReservationsConfigClient
          initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
          initialUpdatedAt={res.ok ? res.updatedAt : null}
          initialNeedsAttention={res.ok ? res.needsAttention : []}
          loadError={res.ok ? null : res.error}
        />
      </div>
    </PageContainer>
  );
}
