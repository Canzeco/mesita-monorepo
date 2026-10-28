import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { buildEnrichment, DAY, NO_RETRY, type EnrichJob } from "./enrich.ts";
import { buildCommit, runLog, stepsLine, thrownMessage } from "./run-log.ts";
import { runCost, stopEnriching, writeFinishedPlace } from "./write-place.ts";
import { CostLedger } from "./cost.ts";

// One place. The whole enrichment runs here, then one write, or no write.
// A listing Google calls permanently closed stops at Details: the stop records
// it and the task finishes without a profile write. A throw turns enriching
// off before the task exits.
// Start (with the build's commit), the steps, finish, and the error are one
// line each, so Testing › Logs shows the run. What the run spent rides the
// write or the stop (MESITA-2806), and the finish line prints the total.
export const enrichSinglePlace = task(
  { name: "enrich-single-place", retry: NO_RETRY, timeoutSeconds: DAY },
  async function enrichSinglePlace(_ctx: TaskContext, job: EnrichJob): Promise<{ placeId: string }> {
    const placeId = job?.placeId ?? "";
    console.log(runLog("start", `${placeId} commit=${buildCommit()}`));
    const startedAt = new Date().toISOString();
    const ledger = new CostLedger();
    try {
      const built = await buildEnrichment(job, ledger);
      if (built.closed) {
        await stopEnriching(placeId, { closed: true, cost: runCost(ledger, startedAt) });
        console.log(runLog("finished", `${placeId}: Google reports it permanently closed; nothing was written`));
        return { placeId };
      }
      if (built.ran?.length) console.log(runLog("steps", stepsLine(placeId, built.ran)));
      const cost = runCost(ledger, startedAt);
      const written = await writeFinishedPlace(placeId, built, job.baseUpdatedAt, cost);
      console.log(runLog("finished", `${placeId} cost=$${cost.usd.toFixed(4)}`));
      return written;
    } catch (err) {
      console.error(runLog("error", `${placeId}: ${thrownMessage(err)}`));
      await stopEnriching(placeId, { cost: runCost(ledger, startedAt) });
      throw err;
    }
  },
);
