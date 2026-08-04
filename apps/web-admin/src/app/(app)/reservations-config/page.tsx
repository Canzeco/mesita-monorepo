import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getReservationsConfig } from "./actions";
import { ReservationsConfigClient } from "./ReservationsConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Reservations Config — one page, no tabs (the Playground was retired
// 2026-07-27; test from the consumer app with test mode ON). Server-seeds the
// live row and passes loadError so a failed load can't be saved over.
export const dynamic = "force-dynamic";

export default async function ReservationsConfigPage() {
  const res = await getReservationsConfig();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations · Reservations"
        title="Reservations Config"
        description="The Reservationist is a voice agent, not a form: a Supabase function briefs the ElevenLabs fleet and it phones the venue over Twilio. Tune the number it dials while testing and the channel it books through — then test end-to-end by reserving in the consumer app."
      />
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
