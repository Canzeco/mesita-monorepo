// Consumer MCP personal access tokens (Me → AI) — mirrors web-consumer.

import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

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
  label?: string,
): Promise<McpTokenMinted> {
  const { token } = await invokeEF<{ token: McpTokenMinted }>(
    supabase,
    'consumer-web-create-mcp-token',
    label ? { label } : {},
  );
  return token;
}

export async function apiListMcpTokens(): Promise<McpTokenMeta[]> {
  const { tokens } = await invokeEF<{ tokens: McpTokenMeta[] }>(
    supabase,
    'consumer-web-list-mcp-tokens',
    {},
  );
  return tokens;
}

export async function apiRevokeMcpToken(tokenId: string): Promise<void> {
  await invokeEF(supabase, 'consumer-web-revoke-mcp-token', {
    token_id: tokenId,
  });
}
