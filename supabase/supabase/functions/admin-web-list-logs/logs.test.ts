import { assertEquals } from "jsr:@std/assert@1";
import {
  ENRICHMENT_WORKFLOW,
  logsUrl,
  pickEnrichmentWorkflow,
  readLogPage,
  readWorkflowPage,
  redactLine,
  type WorkflowRow,
} from "./logs.ts";

const ENRICH: WorkflowRow = {
  id: "wfl-enrich",
  name: ENRICHMENT_WORKFLOW.name,
  slug: ENRICHMENT_WORKFLOW.slug,
  ownerId: "tea-1",
};

Deno.test("the enrichment workflow is the task slug, then the blueprint name", () => {
  const other: WorkflowRow = {
    id: "wfl-other",
    name: "other",
    slug: "other",
    ownerId: "tea-1",
  };
  assertEquals(pickEnrichmentWorkflow([other, ENRICH])?.id, "wfl-enrich");
  assertEquals(
    pickEnrichmentWorkflow([{ ...ENRICH, slug: "renamed" }])?.id,
    "wfl-enrich",
  );
  assertEquals(pickEnrichmentWorkflow([other]), null);
});

Deno.test("a workflow page unwraps Render's cursor envelope", () => {
  const page = readWorkflowPage([
    { workflow: ENRICH, cursor: "c1" },
    { workflow: { id: "wfl-bare" }, cursor: "c2" },
  ]);
  assertEquals(page.rows, [ENRICH]);
  assertEquals(page.nextCursor, "c2");
  assertEquals(readWorkflowPage(null), { rows: [], nextCursor: null });
});

Deno.test("a log page keeps the line and drops the secret", () => {
  const page = readLogPage({
    hasMore: true,
    logs: [
      {
        id: "log-1",
        timestamp: "2026-10-15T20:00:00.000Z",
        message: "start Bearer rnd_secret and sk-live and AIzaSyabc",
        labels: [
          { name: "level", value: "error" },
          { name: "task", value: "enrich-single-place" },
          { name: "taskRun", value: "trn-1" },
        ],
      },
      { id: "", timestamp: "2026-10-15T20:00:00.000Z", message: "skip" },
    ],
  });
  assertEquals(page.hasMore, true);
  assertEquals(page.lines.length, 1);
  assertEquals(page.lines[0]?.level, "error");
  assertEquals(page.lines[0]?.task, "enrich-single-place");
  assertEquals(page.lines[0]?.taskRun, "trn-1");
  assertEquals(page.lines[0]?.message.includes("rnd_"), false);
  assertEquals(page.lines[0]?.message.includes("sk-"), false);
  assertEquals(page.lines[0]?.message.includes("AIza"), false);
  assertEquals(page.lines[0]?.message.includes("[redacted]"), true);
});

Deno.test("redact leaves an ordinary enrichment line alone", () => {
  assertEquals(redactLine("[enrich] wrote Strana"), "[enrich] wrote Strana");
});

Deno.test("the log query is the workflow, app lines, last day, newest first", () => {
  const url = new URL(logsUrl(ENRICH, Date.parse("2026-10-15T20:00:00.000Z")));
  assertEquals(url.origin + url.pathname, "https://api.render.com/v1/logs");
  assertEquals(url.searchParams.get("ownerId"), "tea-1");
  assertEquals(url.searchParams.getAll("resource"), ["wfl-enrich"]);
  assertEquals(url.searchParams.get("direction"), "backward");
  assertEquals(url.searchParams.get("limit"), "100");
  assertEquals(url.searchParams.getAll("type"), ["app"]);
  assertEquals(url.searchParams.get("startTime"), "2026-10-14T20:00:00.000Z");
});
