// supabase-edgefunc-sync-reservationist · modes "tests", "run_tests" and
// "test_results" (MESITA-3967).
//
//   tests         create or update every test of _shared/reservationist/tests.ts
//                 in the workspace, matched by name. The repo wins.
//   run_tests     run each agent's tests against its saved configuration;
//                 answers one invocation id per agent. Body { agent } runs one.
//   test_results  body { invocation_ids: [...] }: each run read back as
//                 passed / failed / pending with the evaluator's reason.
//
// Every tool is mocked (mocking_strategy "all"): a test never reaches a
// reservation. A simulation is text; it does not hear timing or barge-in.

import type { BaseCtx, WorkspaceCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { FLEET_TESTS, type FleetTest, TEST_PREFIX, testName } from "../../_shared/reservationist/tests.ts";

type TestRow = { id?: string; name?: string; type?: string };

/** Each tool the test names answers like the real Edge Function would. */
function mockOverrides(t: FleetTest, toolIdByName: Map<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, result] of Object.entries(t.mocks ?? {})) {
    const id = toolIdByName.get(name);
    const isError = (t.failing ?? []).includes(name as never);
    if (id && result) out[id] = [{ mock_result: result, parameter_conditions: [], is_error: isError }];
  }
  return out;
}

function testBody(t: FleetTest, toolIdByName: Map<string, string>): Record<string, unknown> {
  return {
    type: "simulation",
    name: testName(t),
    simulation_scenario: t.scenario,
    success_conditions: t.conditions,
    simulation_max_turns: t.maxTurns ?? 6,
    dynamic_variables: t.variables ?? {},
    conversation_initiation_source: "twilio",
    tool_mock_config: { mocking_strategy: "all", fallback_strategy: "raise_error", mocked_tool_ids: [] },
    tool_mock_overrides: mockOverrides(t, toolIdByName),
  };
}

/** The workspace's own tests, by name. Only names with our prefix count. */
async function listOurTests(key: string): Promise<{ ok: true; byName: Map<string, string> } | { ok: false; error: string }> {
  const byName = new Map<string, string>();
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const qs = new URLSearchParams({ search: TEST_PREFIX, page_size: "100" });
    if (cursor) qs.set("cursor", cursor);
    const res = await elFetch(key, `/v1/convai/agent-testing?${qs}`);
    if (!res.ok) return { ok: false, error: res.error };
    const body = res.body as { tests?: TestRow[]; has_more?: boolean; next_cursor?: string | null } | null;
    for (const row of body?.tests ?? []) {
      if (row.id && row.name?.startsWith(`${TEST_PREFIX} · `)) byName.set(row.name, row.id);
    }
    if (!body?.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }
  return { ok: true, byName };
}

export async function tests(ctx: WorkspaceCtx): Promise<Response> {
  const listed = await listOurTests(ctx.key);
  if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
  const rows: Array<Record<string, unknown>> = [];
  for (const t of FLEET_TESTS) {
    const name = testName(t);
    const id = listed.byName.get(name);
    const res = id
      ? await elFetch(ctx.key, `/v1/convai/agent-testing/${encodeURIComponent(id)}`, { method: "PUT", body: testBody(t, ctx.toolIdByName) })
      : await elFetch(ctx.key, "/v1/convai/agent-testing/create", { method: "POST", body: testBody(t, ctx.toolIdByName) });
    if (!res.ok) {
      rows.push({ name, agent: t.agent, ok: false, error: res.error });
      continue;
    }
    const newId = id ?? (res.body as { id?: string } | null)?.id ?? null;
    rows.push({ name, agent: t.agent, id: newId, action: id ? "updated" : "created", ok: !!newId });
  }
  // A test the repo no longer has is reported, never deleted here.
  const wanted = new Set(FLEET_TESTS.map(testName));
  const extra = [...listed.byName.keys()].filter((n) => !wanted.has(n));
  const failed = rows.filter((r) => r.ok !== true).length;
  return json(
    { ok: failed === 0, mode: ctx.mode, tests: rows, not_in_repo: extra },
    failed === 0 ? 200 : 502,
  );
}

export async function runTests(ctx: WorkspaceCtx): Promise<Response> {
  const only = typeof (ctx.body as { agent?: unknown }).agent === "string"
    ? ((ctx.body as { agent?: string }).agent ?? "").trim()
    : "";
  const listed = await listOurTests(ctx.key);
  if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
  const runs: Array<Record<string, unknown>> = [];
  const agents = [...new Set(FLEET_TESTS.map((t) => t.agent))].filter((a) => !only || a === only);
  for (const agent of agents) {
    const agentId = ctx.configuredAgents[agent]?.id?.trim();
    const wanted = FLEET_TESTS.filter((t) => t.agent === agent).map(testName);
    const ids = wanted.map((n) => listed.byName.get(n)).filter((x): x is string => !!x);
    if (!agentId || ids.length !== wanted.length) {
      runs.push({
        agent,
        ok: false,
        error: !agentId ? "missing agents_config id" : `${wanted.length - ids.length} test(s) not pushed: run mode "tests" first`,
      });
      continue;
    }
    const res = await elFetch(ctx.key, `/v1/convai/agents/${encodeURIComponent(agentId)}/run-tests`, {
      method: "POST",
      body: { tests: ids.map((test_id) => ({ test_id })), name: `mesita ${agent} ${new Date().toISOString()}` },
    });
    if (!res.ok) {
      runs.push({ agent, ok: false, error: res.error });
      continue;
    }
    runs.push({ agent, ok: true, invocation_id: (res.body as { id?: string } | null)?.id ?? null, tests: ids.length });
  }
  const failed = runs.filter((r) => r.ok !== true).length;
  return json({ ok: failed === 0, mode: ctx.mode, runs }, failed === 0 ? 200 : 502);
}

type Turn = {
  role?: string;
  message?: string | null;
  tool_calls?: Array<{ tool_name?: string; params_as_json?: string }> | null;
  tool_results?: Array<{ tool_name?: string; result_value?: string; is_error?: boolean }> | null;
};
type RunRow = {
  test_name?: string;
  status?: string;
  condition_result?: { result?: string; rationale?: { summary?: string; messages?: string[] } | null } | null;
  metadata?: { test_name?: string } | null;
  agent_responses?: Turn[] | null;
};

/** The evaluator's reasons, each one: the summary alone says only
 *  "Evaluation failed". */
function reasons(r: RunRow): string {
  const rat = r.condition_result?.rationale;
  return [rat?.summary, ...(rat?.messages ?? [])].filter((x) => !!x && x.trim()).join(" · ").slice(0, 1500);
}

/** The simulated call, one line per turn, with every tool the agent fired
 *  and what it answered — a stall at a tool node is otherwise invisible
 *  (MESITA-4027). */
function callLines(r: RunRow): string[] {
  const lines: string[] = [];
  for (const t of r.agent_responses ?? []) {
    for (const c of t?.tool_calls ?? []) {
      lines.push(`TOOL→ ${c.tool_name ?? "?"}(${(c.params_as_json ?? "").slice(0, 200)})`);
    }
    for (const res of t?.tool_results ?? []) {
      lines.push(`TOOL← ${res.tool_name ?? "?"}${res.is_error ? " ERROR" : ""}: ${(res.result_value ?? "").slice(0, 200)}`);
    }
    if (typeof t?.message === "string" && t.message.trim()) {
      lines.push(`${t.role === "agent" ? "Agent" : "Caller"}: ${t.message.trim()}`.slice(0, 300));
    }
  }
  return lines.slice(0, 40);
}

/** With { raw: true }, a failed run also carries the END of its turns as
 *  ElevenLabs returned them — a stall is at the end (MESITA-4028) — and
 *  every workflow step: an edge taken (edge → node) or a tool a node fired. */
function rawTurns(r: RunRow): { steps: string[]; tail: string } {
  const text = JSON.stringify(r.agent_responses ?? []);
  const steps: string[] = [];
  const re = /\\?"edge_id\\?":\\?"([^"\\]+)\\?",\\?"target_node_id\\?":\\?"([^"\\]+)|\\?"tool_name\\?":\\?"([^"\\]+)/g;
  for (const m of text.matchAll(re)) {
    steps.push(m[1] ? `${m[1]} → ${m[2]}` : `tool ${m[3]}`);
  }
  return { steps: steps.slice(-80), tail: text.slice(-12000) };
}

export async function testResults(ctx: BaseCtx): Promise<Response> {
  const raw = (ctx.body as { invocation_ids?: unknown }).invocation_ids;
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x)) : [];
  if (ids.length === 0) return json({ ok: false, error: "invocation_ids: string[] required" }, 400);
  const wantRaw = (ctx.body as { raw?: unknown }).raw === true;
  const invocations: Array<Record<string, unknown>> = [];
  for (const id of ids.slice(0, 10)) {
    const res = await elFetch(ctx.key, `/v1/convai/test-invocations/${encodeURIComponent(id)}`);
    if (!res.ok) {
      invocations.push({ id, ok: false, error: res.error });
      continue;
    }
    const runs = ((res.body as { test_runs?: RunRow[] } | null)?.test_runs ?? []).map((r) => ({
      test: r.metadata?.test_name ?? r.test_name ?? null,
      status: r.status ?? null,
      result: r.condition_result?.result ?? null,
      why: reasons(r),
      ...(r.status === "failed" ? { call: callLines(r) } : {}),
      ...(r.status === "failed" && wantRaw ? { raw: rawTurns(r) } : {}),
    }));
    invocations.push({
      id,
      ok: true,
      passed: runs.filter((r) => r.status === "passed").length,
      failed: runs.filter((r) => r.status === "failed").length,
      pending: runs.filter((r) => r.status === "pending").length,
      runs,
    });
  }
  return json({ ok: true, mode: ctx.mode, invocations });
}
