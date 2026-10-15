// What a direct enrich call starts. One place is enrich single place. A list
// is enrich multiple places, and Render decides how many run at once.
// The Google place id rides along so Render does not read the database.

const WORKFLOW = "mesita-monorepo";

export type EnrichJob = { placeId: string; googlePlaceId: string };

/** The only write before the profile exists. The proxy sets it after Render
 *  accepts the run, and returns. Render writes the profile once, at the end. */
export const ENRICHING_PATCH = { content_state: "generating" } as const;

/** The live secret is RENDER_KEY. RENDER_API_KEY is the older name. */
export function renderApiKey(env: { get(name: string): string | undefined }): string {
  return (env.get("RENDER_KEY") ?? env.get("RENDER_API_KEY") ?? "").trim();
}

export function enrichmentRun(jobs: readonly EnrichJob[]): { task: string; input: unknown[] } {
  if (jobs.length === 1) {
    return { task: `${WORKFLOW}/enrich-single-place`, input: [jobs[0]] };
  }
  return { task: `${WORKFLOW}/enrich-multiple-places`, input: [jobs] };
}
