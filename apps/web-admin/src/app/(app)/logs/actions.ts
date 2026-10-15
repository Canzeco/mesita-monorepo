"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import type { LogLine, LogsPayload } from "./filter";

export type ListLogsResult = ActionResult<LogsPayload>;

function asLine(value: unknown): LogLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.timestamp !== "string") return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    message: typeof row.message === "string" ? row.message : "",
    level: typeof row.level === "string" ? row.level : null,
    task: typeof row.task === "string" ? row.task : null,
    taskRun: typeof row.taskRun === "string" ? row.taskRun : null,
  };
}

export async function listLogs(): Promise<ListLogsResult> {
  const r = await efInvoke<{
    workflow?: { id?: unknown; name?: unknown; slug?: unknown };
    lines?: unknown;
    hasMore?: unknown;
  }>("admin-web-list-logs", {});
  if (!r.ok) return { ok: false, error: r.error };
  const workflow = r.data.workflow;
  const lines = Array.isArray(r.data.lines)
    ? r.data.lines.flatMap((line) => {
      const parsed = asLine(line);
      return parsed ? [parsed] : [];
    })
    : [];
  return {
    ok: true,
    workflow: {
      id: typeof workflow?.id === "string" ? workflow.id : "",
      name: typeof workflow?.name === "string" ? workflow.name : "",
      slug: typeof workflow?.slug === "string" ? workflow.slug : "",
    },
    lines,
    hasMore: r.data.hasMore === true,
  };
}
