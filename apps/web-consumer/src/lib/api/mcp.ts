// Me › Integrations › MCP (MESITA-3971): the guest's private connector URL
// for Claude and ChatGPT.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type McpLink = { url: string; last_used_at: string | null };

/** The connector URL; `reset` makes a new one and kills the old. */
export async function apiGetMcpLink(
  client: SupabaseClient,
  reset = false,
): Promise<McpLink> {
  const res = await invokeEF<McpLink>(
    client,
    "consumer-web-get-mcp-link",
    reset ? { reset: true } : {},
  );
  return { url: res.url, last_used_at: res.last_used_at ?? null };
}
