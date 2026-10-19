// Supabase Edge Function — admin-web-list-logs
//
// Recent app lines from the enrichment workflow. Super-admin only. The
// Render key stays here; the console never calls Render itself.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { renderApiKey } from "../_shared/enrich-start.ts";
import {
  pickEnrichmentWorkflow,
  readLogPage,
  readWorkflowPage,
  redactLine,
  logsUrl,
  type WorkflowRow,
} from "./logs.ts";

const RENDER = "https://api.render.com/v1";

type FetchResult =
  | { ok: true; body: unknown }
  | { ok: false; error: string; status: number };

async function renderGet(key: string, url: string): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const why = err instanceof Error ? err.message : "request failed";
    return { ok: false, error: redactLine(why), status: 502 };
  }
  const text = await res.text();
  if (!res.ok) {
    const detail = redactLine(text).slice(0, 200);
    return {
      ok: false,
      error: detail || `Render returned ${res.status}`,
      status: 502,
    };
  }
  try {
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch {
    return { ok: false, error: "Render returned a body that is not JSON", status: 502 };
  }
}

async function findWorkflow(key: string): Promise<
  { ok: true; workflow: WorkflowRow } | { ok: false; error: string; status: number }
> {
  const rows: WorkflowRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = new URL(`${RENDER}/workflows`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const listed = await renderGet(key, url.toString());
    if (!listed.ok) return listed;
    const parsed = readWorkflowPage(listed.body);
    rows.push(...parsed.rows);
    const found = pickEnrichmentWorkflow(rows);
    if (found) return { ok: true, workflow: found };
    if (!parsed.nextCursor || parsed.nextCursor === cursor) break;
    cursor = parsed.nextCursor;
  }
  return { ok: false, error: "Enrichment workflow not found", status: 404 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can read logs.");
  if (!guard.ok) return guard.response;

  const key = renderApiKey(Deno.env);
  if (!key) return json({ ok: false, error: "Server misconfigured" }, 500);

  const workflow = await findWorkflow(key);
  if (!workflow.ok) return json({ ok: false, error: workflow.error }, workflow.status);

  const logs = await renderGet(key, logsUrl(workflow.workflow, Date.now()));
  if (!logs.ok) return json({ ok: false, error: logs.error }, logs.status);

  const page = readLogPage(logs.body);
  return json({
    ok: true,
    workflow: {
      id: workflow.workflow.id,
      name: workflow.workflow.name,
      slug: workflow.workflow.slug,
    },
    lines: page.lines,
    hasMore: page.hasMore,
  });
});
