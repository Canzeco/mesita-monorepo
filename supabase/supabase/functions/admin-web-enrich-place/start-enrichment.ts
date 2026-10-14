// What a direct enrich call starts. One place is enrichSingle. A list is one
// enrichMultiple, and the workflow runtime decides how many run at once.

const WORKFLOW = "mesita-monorepo";

export function enrichmentRun(placeIds: readonly string[]): { task: string; input: unknown[] } {
  if (placeIds.length === 1) {
    return { task: `${WORKFLOW}/enrichSingle`, input: [placeIds[0]] };
  }
  return { task: `${WORKFLOW}/enrichMultiple`, input: [placeIds] };
}
