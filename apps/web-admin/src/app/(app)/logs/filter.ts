export type LogLine = {
  id: string;
  timestamp: string;
  message: string;
  level: string | null;
  task: string | null;
  taskRun: string | null;
};

export type LogsPayload = {
  workflow: { id: string; name: string; slug: string };
  lines: LogLine[];
  hasMore: boolean;
};

/** A typed query matches the line, its level, or its task. Blank shows all. */
export function filterLines(lines: readonly LogLine[], query: string): LogLine[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...lines];
  return lines.filter((line) => {
    const haystack = [line.message, line.level ?? "", line.task ?? ""].join("\n").toLowerCase();
    return haystack.includes(needle);
  });
}
