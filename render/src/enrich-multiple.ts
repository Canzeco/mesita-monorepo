import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { enrichSinglePlace } from "./enrich-single.ts";
import { AT_ONCE, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";

// A list of places. Render decides the wave size. Each place is still one write.
export const enrichMultiplePlaces = task(
  { name: "enrich-multiple-places", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichMultiplePlaces(ctx: TaskContext, jobs: EnrichJob[]): Promise<{ placeId: string }[]> {
    const results: { placeId: string }[] = [];
    for (let i = 0; i < jobs.length; i += AT_ONCE) {
      const wave = jobs.slice(i, i + AT_ONCE);
      const done = await Promise.all(wave.map((job) => ctx.run(enrichSinglePlace, job)));
      results.push(...done);
    }
    return results;
  },
);
