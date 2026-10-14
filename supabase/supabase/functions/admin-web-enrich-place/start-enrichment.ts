// What a direct enrich call starts. One place is enrichSingle. A list is one
// enrichMultiple, and the workflow runtime decides how many run at once.
// The Google place id rides along so Render does not read the database.

const WORKFLOW = "mesita-monorepo";

export type EnrichJob = { placeId: string; googlePlaceId: string };

export function enrichmentRun(jobs: readonly EnrichJob[]): { task: string; input: unknown[] } {
  if (jobs.length === 1) {
    return { task: `${WORKFLOW}/enrichSingle`, input: [jobs[0]] };
  }
  return { task: `${WORKFLOW}/enrichMultiple`, input: [jobs] };
}
