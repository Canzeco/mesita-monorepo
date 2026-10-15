import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { buildEnrichment, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";
import { writeFinishedPlace } from "./write-place.ts";

// One place. The whole enrichment runs here, then one write, or no write.
export const enrichSinglePlace = task(
  { name: "enrich-single-place", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSinglePlace(_ctx: TaskContext, job: EnrichJob): Promise<{ placeId: string }> {
    const built = await buildEnrichment(job);
    return writeFinishedPlace(job.placeId, built.patch, built.mirrorPhotos);
  },
);
