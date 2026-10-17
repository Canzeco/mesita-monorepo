import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { buildEnrichment, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";
import { runLog, thrownMessage } from "./run-log.ts";
import { stopEnriching, writeFinishedPlace } from "./write-place.ts";

// One place. The whole enrichment runs here, then one write, or no write.
// A throw turns enriching off before the task exits.
// Start, finish, and the error are one line each, so Testing › Logs shows the run.
export const enrichSinglePlace = task(
  { name: "enrich-single-place", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSinglePlace(_ctx: TaskContext, job: EnrichJob): Promise<{ placeId: string }> {
    const placeId = job?.placeId ?? "";
    console.log(runLog("start", `${placeId} overwrite=${job.overwrite === true ? "on" : "off"}`));
    try {
      const built = await buildEnrichment(job);
      const written = await writeFinishedPlace(
        placeId,
        built.patch,
        built.mirrorPhotos,
        job.baseUpdatedAt,
        built.photoAnalyses,
      );
      console.log(runLog("finished", placeId));
      return written;
    } catch (err) {
      console.error(runLog("error", `${placeId}: ${thrownMessage(err)}`));
      await stopEnriching(placeId);
      throw err;
    }
  },
);
