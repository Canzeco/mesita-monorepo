// One row on Testing › Logs. Render stores each newline as its own line, so a
// vendor body has to be flattened or the console shows a pile of fragments.

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function runLog(kind: "start" | "finished" | "error", text: string): string {
  return `[enrich] ${kind} ${oneLine(text)}`;
}

export function thrownMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return oneLine(message);
}
