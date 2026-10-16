// Pure readers for the enrichment workflow's log. The EF fetches; this file
// decides which workflow and which lines the console shows.

export const ENRICHMENT_WORKFLOW = {
  name: "mesita-enrich",
  slug: "mesita-monorepo",
} as const;

export const LOG_LIMIT = 100;
export const LOG_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WorkflowRow = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
};

export type LogLine = {
  id: string;
  timestamp: string;
  message: string;
  level: string | null;
  task: string | null;
  taskRun: string | null;
};

type WorkflowPage = {
  rows: WorkflowRow[];
  nextCursor: string | null;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Bearer tokens and vendor key shapes never reach the console. */
export function redactLine(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\brnd_[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\bsk[-_][A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\bAIza[A-Za-z0-9_-]+\b/g, "[redacted]");
}

function asWorkflow(value: unknown): WorkflowRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = str(row.id);
  const ownerId = str(row.ownerId);
  if (!id || !ownerId) return null;
  return {
    id,
    name: str(row.name) ?? "",
    slug: str(row.slug) ?? "",
    ownerId,
  };
}

/** Render wraps each row as `{ workflow, cursor }`. A bare object is accepted too. */
export function readWorkflowPage(body: unknown): WorkflowPage {
  if (!Array.isArray(body) || body.length === 0) {
    return { rows: [], nextCursor: null };
  }
  const rows: WorkflowRow[] = [];
  let nextCursor: string | null = null;
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const workflow = asWorkflow(record.workflow ?? record);
    if (workflow) rows.push(workflow);
    const cursor = str(record.cursor);
    if (cursor) nextCursor = cursor;
  }
  return { rows, nextCursor };
}

/** The task slug wins. The blueprint name is the fallback. */
export function pickEnrichmentWorkflow(rows: readonly WorkflowRow[]): WorkflowRow | null {
  return rows.find((row) => row.slug === ENRICHMENT_WORKFLOW.slug) ??
    rows.find((row) => row.name === ENRICHMENT_WORKFLOW.name) ??
    null;
}

function labelValue(
  labels: unknown,
  name: string,
): string | null {
  if (!Array.isArray(labels)) return null;
  for (const label of labels) {
    if (!label || typeof label !== "object") continue;
    const row = label as Record<string, unknown>;
    if (row.name === name) return str(row.value);
  }
  return null;
}

export function readLogPage(body: unknown): { lines: LogLine[]; hasMore: boolean } {
  if (!body || typeof body !== "object") return { lines: [], hasMore: false };
  const record = body as Record<string, unknown>;
  const logs = record.logs;
  if (!Array.isArray(logs)) return { lines: [], hasMore: false };
  const lines: LogLine[] = [];
  for (const item of logs) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = str(row.id);
    const timestamp = str(row.timestamp);
    if (!id || !timestamp) continue;
    const message = redactLine(typeof row.message === "string" ? row.message : "");
    lines.push({
      id,
      timestamp,
      message,
      level: labelValue(row.labels, "level"),
      task: labelValue(row.labels, "task"),
      taskRun: labelValue(row.labels, "taskRun"),
    });
  }
  return { lines, hasMore: record.hasMore === true };
}

export function logsUrl(workflow: WorkflowRow, now: number): string {
  const url = new URL("https://api.render.com/v1/logs");
  url.searchParams.set("ownerId", workflow.ownerId);
  url.searchParams.append("resource", workflow.id);
  url.searchParams.set("direction", "backward");
  url.searchParams.set("limit", String(LOG_LIMIT));
  url.searchParams.append("type", "app");
  url.searchParams.set("startTime", new Date(now - LOG_WINDOW_MS).toISOString());
  return url.toString();
}
