import { Suspense } from "react";
import { ConfigPageLayout } from "@/components/admin-ui";
import { getReservationsConfig } from "./actions";
import { CallCostCard, CallCostShell } from "./CallCostCard";
import { ReservationsConfigClient } from "./ReservationsConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Reservations — Testing, then Call
// cost (MESITA-4043), which streams in on its own. MESITA-2122 cut the Calls
// card (kill switch, caps, reminder, enrich override) and the fleet strip;
// those knobs live on in the stored row.
export const dynamic = "force-dynamic";

export default async function ReservationsConfigPage() {
  const res = await getReservationsConfig();
  return (
    <ConfigPageLayout
      title="Reservations"
      description="Mesita's voice agent books tables by phone. Keep it on the test number until a real run."
    >
      <div className="flex flex-col gap-4">
        <ReservationsConfigClient
          initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
          loadError={res.ok ? null : res.error}
        />
        <Suspense
          fallback={
            <CallCostShell>
              <p className="text-muted-foreground mt-5 text-sm">Reading ElevenLabs…</p>
            </CallCostShell>
          }
        >
          <CallCostCard />
        </Suspense>
      </div>
    </ConfigPageLayout>
  );
}
