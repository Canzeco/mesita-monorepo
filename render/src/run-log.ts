// One row on Testing › Logs. Render stores each newline as its own line, so a
// vendor body has to be flattened or the console shows a pile of fragments.

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function runLog(kind: "start" | "steps" | "finished" | "error", text: string): string {
  return `[enrich] ${kind} ${oneLine(text)}`;
}

/** The build that ran, so the start line proves which commit enriched the place. */
export function buildCommit(env: Record<string, string | undefined> = process.env): string {
  return env.RENDER_GIT_COMMIT?.trim().slice(0, 7) || "unknown";
}

/** One line per run (Testing › Logs keeps 100): each step's time and what this
 *  run itself produced, before saved values win under Overwrite off. */
export function stepsLine(
  placeId: string,
  steps: readonly { step: string; ms: number; produced: string }[],
): string {
  return `${placeId} ${steps.map((s) => `${s.step}=${s.produced}(${Math.round(s.ms)}ms)`).join(" ")}`;
}

export function thrownMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return oneLine(message);
}
