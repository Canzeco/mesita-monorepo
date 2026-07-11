// Frontend API for Consumer MCP personal access tokens (Me → AI).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type McpTokenMeta = {
  id: string;
  token_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type McpTokenMinted = {
  id: string;
  /** Plaintext — shown once at mint. Never re-fetched. */
  token: string;
  token_prefix: string;
  label: string;
  created_at: string;
  mcp_url: string;
};

export async function apiCreateMcpToken(
  client: SupabaseClient,
  label?: string,
): Promise<McpTokenMinted> {
  const { token } = await invokeEF<{ token: McpTokenMinted }>(
    client,
    "consumer-web-create-mcp-token",
    label ? { label } : {},
  );
  return token;
}

export async function apiListMcpTokens(
  client: SupabaseClient,
): Promise<McpTokenMeta[]> {
  const { tokens } = await invokeEF<{ tokens: McpTokenMeta[] }>(
    client,
    "consumer-web-list-mcp-tokens",
    {},
  );
  return tokens;
}

export async function apiRevokeMcpToken(
  client: SupabaseClient,
  tokenId: string,
): Promise<void> {
  await invokeEF(client, "consumer-web-revoke-mcp-token", {
    token_id: tokenId,
  });
}
