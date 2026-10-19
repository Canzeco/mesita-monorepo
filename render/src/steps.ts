// What a step the task ran reports to the write, which stamps it. Only the
// steps whose outcome the write cannot see in the profile report here: the
// Scout (its read never reaches the row) and Links (the write cannot tell
// "nothing found" from "the Resolver did not answer").
//
// completed: the step ran and its effect landed, and finding nothing is a
// result. failed: it had something to do and could not do it.

export type StepReport = { state: "completed" | "failed"; detail: string };

export type RanSteps = Partial<Record<"serp" | "links", StepReport>>;

export function completed(detail: string): StepReport {
  return { state: "completed", detail };
}

export function failed(detail: string): StepReport {
  return { state: "failed", detail };
}
