import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { describeFromFacts, fetchGooglePlace, fetchTimezone, profileFromGoogle } from "./google-spine.ts";
import { writeFinishedPlace } from "./write-place.ts";

// Paid vendor calls must not be replayed by the platform.
const NO_RETRY = { maxRetries: 0, waitDurationMs: 1000, backoffScaling: 1 };
const DAY = 86400;
// Two places at a time. Each one already calls Google and, when needed, OpenAI.
const AT_ONCE = 2;

export type EnrichJob = { placeId: string; googlePlaceId: string };

// A finished place is the Google spine plus a description. The description is
// Google's own summary when it has one, otherwise one written from those facts.
// Anything short of that throws before the write.
export async function buildEnrichment(job: EnrichJob): Promise<Record<string, unknown>> {
  const googlePlaceId = job.googlePlaceId?.trim() ?? "";
  if (!job.placeId?.trim() || !googlePlaceId) {
    throw new Error("Enrichment needs a place id and a Google place id.");
  }
  const googleKey = process.env.GMP_KEY?.trim() ?? "";
  if (!googleKey) throw new Error("Render is missing GMP_KEY");

  const details = await fetchGooglePlace(googlePlaceId, googleKey);
  const spine = profileFromGoogle(details, googlePlaceId);
  if (!spine.ok) throw new Error(spine.error);
  const lat = spine.patch.lat;
  const lng = spine.patch.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    const timezone = await fetchTimezone(lat, lng, googleKey);
    if (timezone) spine.patch.timezone = timezone;
  }

  let description = spine.description;
  if (!description) {
    const openaiKey = process.env.OPENAI_KEY?.trim() ?? "";
    if (!openaiKey) throw new Error("Google has no summary and Render is missing OPENAI_KEY");
    description = await describeFromFacts(spine.facts, openaiKey);
  }
  if (!description) throw new Error("The place has no description, so it was not written.");

  return {
    ...spine.patch,
    description,
    content_state: "ready",
    enriched_at: new Date().toISOString(),
  };
}

export const enrichSingle = task(
  { name: "enrichSingle", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSingle(_ctx: TaskContext, job: EnrichJob): Promise<{ placeId: string }> {
    const patch = await buildEnrichment(job);
    return writeFinishedPlace(job.placeId, patch);
  },
);

export const enrichMultiple = task(
  { name: "enrichMultiple", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichMultiple(ctx: TaskContext, jobs: EnrichJob[]): Promise<{ placeId: string }[]> {
    const results: { placeId: string }[] = [];
    for (let i = 0; i < jobs.length; i += AT_ONCE) {
      const wave = jobs.slice(i, i + AT_ONCE);
      const done = await Promise.all(wave.map((job) => ctx.run(enrichSingle, job)));
      results.push(...done);
    }
    return results;
  },
);
