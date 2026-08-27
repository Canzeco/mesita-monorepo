// Multiple Places Intake batch policy.
//
// Create is NOT scheduled. Fire every Google Place ID in one batch — Google
// accepts that fan-out. Enrich IS scheduled: admin-web-enrich-place only
// seeds place_research; pg_cron claims one row at a time. The bottleneck
// is the enrich process, not create.

export type IntakeAction = "create" | "enrich" | "create_enrich";

/** Create and Create+Enrich start every create at once. Enrich only enqueues. */
export function intakeFansOutCreates(action: IntakeAction): boolean {
  return action !== "enrich";
}

/**
 * After a create returns, Create+Enrich must leave the place on the enrich
 * queue. Create already seeds on_create when that trigger is on; enqueue
 * again only when that did not happen (existing place, or on_create off).
 * Enrich-only always enqueues.
 */
export function intakeShouldEnqueueEnrich(input: {
  action: IntakeAction;
  enrichmentTriggered: boolean;
}): boolean {
  if (input.action === "enrich") return true;
  if (input.action === "create") return false;
  return !input.enrichmentTriggered;
}
