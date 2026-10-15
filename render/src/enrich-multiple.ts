import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { enrichSinglePlace } from "./enrich-single.ts";
import { AT_ONCE, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";
import { runLog, thrownMessage } from "./run-log.ts";
import { placesTheWaveDidNotFinish } from "./wave-stop.ts";
import { stopEnriching } from "./write-place.ts";

// A list of places. Render decides the wave size. Each place is still one write.
// On failure, every place this run did not finish is stopped: one not started,
// and one whose task was killed before its own stop ran.
export const enrichMultiplePlaces = task(
  { name: "enrich-multiple-places", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichMultiplePlaces(ctx: TaskContext, jobs: EnrichJob[]): Promise<{ placeId: string }[]> {
    const results: { placeId: string }[] = [];
    console.log(runLog("start", `${jobs.length} places`));
    try {
      for (let i = 0; i < jobs.length; i += AT_ONCE) {
        const wave = jobs.slice(i, i + AT_ONCE);
        const done = await Promise.all(wave.map((job) => ctx.run(enrichSinglePlace, job)));
        results.push(...done);
      }
      console.log(runLog("finished", `${results.length} places`));
      return results;
    } catch (err) {
      console.error(runLog("error", `${results.length} of ${jobs.length} places: ${thrownMessage(err)}`));
      const left = placesTheWaveDidNotFinish(jobs, results);
      await Promise.all(left.map((placeId) => stopEnriching(placeId)));
      throw err;
    }
  },
);
