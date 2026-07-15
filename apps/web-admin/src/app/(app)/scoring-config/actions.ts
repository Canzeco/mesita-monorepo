import { efInvoke } from "@/lib/supabase-ef";
import { SAMPLE_MAX } from "@/lib/business/cip";
import type { SampleConsumer, SamplePlace } from "@/lib/business/cip";

// Scoring sample for the Card Sim + Deck Sim — REAL consumers and REAL places via the
// dedicated `admin-web-get-scoring-sample` EF (random server-side sample;
// consumer taste from actual saves/visits; place rates joined from projects).
// Clients never touch the DB.
//
// NOT a "use server" module: only the page (a server component) calls this,
// and that directive would forbid every non-async export — SAMPLE_MAX and the
// re-exported types included — failing only at BUILD time, not typecheck.
// `efInvoke` pulls in next/headers, so a client import fails on its own.

export { SAMPLE_MAX };

export type ScoringSample = {
  consumers: SampleConsumer[];
  places: SamplePlace[];
};

export type SampleResult =
  | { ok: true; sample: ScoringSample }
  | { ok: false; error: string };

export async function getScoringSample(): Promise<SampleResult> {
  const r = await efInvoke<{ consumers: SampleConsumer[]; places: SamplePlace[] }>(
    "admin-web-get-scoring-sample",
    { consumers: SAMPLE_MAX, places: SAMPLE_MAX },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    sample: {
      consumers: Array.isArray(r.data?.consumers) ? r.data.consumers : [],
      places: Array.isArray(r.data?.places) ? r.data.places : [],
    },
  };
}
