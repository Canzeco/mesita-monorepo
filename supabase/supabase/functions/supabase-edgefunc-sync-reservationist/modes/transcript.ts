// supabase-edgefunc-sync-reservationist · mode "transcript".
//
// Replay one conversation turn by turn with every tool call — read-only.

import type { BaseCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";

export async function transcript(ctx: BaseCtx): Promise<Response> {
  const { key, mode, body } = ctx;
  const cid = typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  if (!cid) {
    return json({ ok: false, error: "transcript mode needs conversation_id" }, 400);
  }
  const got = await elFetch(key, `/v1/convai/conversations/${encodeURIComponent(cid)}`);
  if (!got.ok) return json({ ok: false, error: got.error }, 502);
  const c = got.body as {
    agent_id?: string;
    status?: string;
    metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
    analysis?: { call_successful?: string; transcript_summary?: string };
    transcript?: Array<{
      role?: string;
      message?: string | null;
      time_in_call_secs?: number;
      tool_calls?: Array<{ tool_name?: string; params_as_json?: string }>;
      tool_results?: Array<{ tool_name?: string; result_value?: string; is_error?: boolean }>;
    }>;
  };
  // Flatten to something readable in a SQL cell: who said what, and every
  // tool the agent fired (the thing that decides whether the ticket moves).
  const turns = (c.transcript ?? []).map((t) => {
    const bits: string[] = [];
    for (const call of t.tool_calls ?? []) {
      bits.push(`TOOL→ ${call.tool_name}(${(call.params_as_json ?? "").slice(0, 240)})`);
    }
    for (const res of t.tool_results ?? []) {
      bits.push(
        `TOOL← ${res.tool_name}${res.is_error ? " ERROR" : ""}: ${
          (res.result_value ?? "").slice(0, 240)
        }`,
      );
    }
    return {
      at: t.time_in_call_secs ?? null,
      role: t.role ?? "?",
      text: (t.message ?? "").slice(0, 400),
      tools: bits.length ? bits : undefined,
    };
  });
  return json({
    ok: true,
    mode,
    conversation_id: cid,
    agent_id: c.agent_id ?? null,
    status: c.status ?? null,
    call_successful: c.analysis?.call_successful ?? null,
    duration_secs: c.metadata?.call_duration_secs ?? null,
    summary: c.analysis?.transcript_summary ?? null,
    // The WHOLE metadata blob, untrimmed. A 0-second "failed" call says
    // nothing in its transcript — the reason (termination_reason, the
    // rejection detail, whether a per-call override rode along) lives in
    // here, and guessing at it burned real debugging time. Whatever field
    // carries the answer next time, it will already be in the response.
    metadata: (c as { metadata?: unknown }).metadata ?? null,
    tools_fired: turns.flatMap((t) => t.tools ?? []),
    turns,
  });
}
