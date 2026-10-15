import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { buildEnrichment, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";
import { stopEnriching, writeFinishedPlace } from "./write-place.ts";

// One place. The whole enrichment runs here, then one write, or no write.
// A throw turns enriching off before the task exits.
export const enrichSinglePlace = task(
  { name: "enrich-single-place", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSinglePlace(_ctx: TaskContext, job: EnrichJob): Promise<{ placeId: string }> {
    try {
      const built = await buildEnrichment(job);
      return await writeFinishedPlace(job.placeId, built.patch, built.mirrorPhotos, job.baseUpdatedAt);
    } catch (err) {
      await stopEnriching(job.placeId);
      throw err;
    }
  },
);
