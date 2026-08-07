-- MESITA-942: document tables already revoked at creation (parity with batch comments).

comment on table public.place_research is
  'Enricher pipeline state. EF-only (RLS, no policies; client privileges revoked). MESITA-942.';
comment on table public.place_creation_attempts is
  'Create-quota ledger. EF-only (RLS, no policies; client privileges revoked). MESITA-942.';
comment on table public.consumer_mcp_tokens is
  'Consumer MCP bearer tokens. EF-only (RLS, no policies; client privileges revoked). MESITA-942.';
comment on table public.admin_reset_preserve is
  'admin_reset_database survivor registry. EF-only. MESITA-942.';
