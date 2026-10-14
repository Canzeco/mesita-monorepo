import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { writeFinishedPlace } from "./write-place.ts";

// Paid vendor calls must not be replayed by the platform.
const NO_RETRY = { maxRetries: 0, waitDurationMs: 1000, backoffScaling: 1 };
const DAY = 86400;
// Two places at a time. Each one already calls Google, OpenAI, Perplexity, Apify, and Firecrawl.
const AT_ONCE = 2;

// The agent builds this. It is not wired yet: the three stage functions are
// still the live enricher. This returns the finished profile, including
// content_state "ready", and nothing else writes the place.
export function buildEnrichment(_placeId: string): Record<string, unknown> {
  throw new Error("The enrichment agent does not produce a document yet.");
}

export const enrichSingle = task(
  { name: "enrichSingle", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSingle(_ctx: TaskContext, placeId: string): Promise<{ placeId: string }> {
    const patch = await buildEnrichment(placeId);
    return writeFinishedPlace(placeId, patch);
  },
);

export const enrichMultiple = task(
  { name: "enrichMultiple", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichMultiple(ctx: TaskContext, placeIds: string[]): Promise<{ placeId: string }[]> {
    const results: { placeId: string }[] = [];
    for (let i = 0; i < placeIds.length; i += AT_ONCE) {
      const wave = placeIds.slice(i, i + AT_ONCE);
      const done = await Promise.all(wave.map((placeId) => ctx.run(enrichSingle, placeId)));
      results.push(...done);
    }
    return results;
  },
);
