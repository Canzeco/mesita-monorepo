// supabase-edgefunc-sync-reservationist · mode "calls".
//
// List recent conversations — read-only.

import type { BaseCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";

export async function calls(ctx: BaseCtx): Promise<Response> {
  const { key, mode, body } = ctx;
  const lim = typeof body.limit === "number" && body.limit > 0
    ? Math.min(Math.trunc(body.limit), 30)
    : 10;
  const listed = await elFetch(key, `/v1/convai/conversations?page_size=${lim}`);
  if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
  const rows = (listed.body as {
    conversations?: Array<{
      conversation_id?: string;
      agent_id?: string;
      agent_name?: string;
      status?: string;
      call_successful?: string;
      start_time_unix_secs?: number;
      call_duration_secs?: number;
      message_count?: number;
    }>;
  } | null)?.conversations ?? [];
  return json({
    ok: true,
    mode,
    count: rows.length,
    conversations: rows.map((r) => ({
      id: r.conversation_id,
      agent: r.agent_name ?? r.agent_id,
      status: r.status,
      successful: r.call_successful,
      secs: r.call_duration_secs,
      turns: r.message_count,
      started_utc: r.start_time_unix_secs
        ? new Date(r.start_time_unix_secs * 1000).toISOString()
        : null,
    })),
  });
}
