-- MESITA-3971 MCP CONNECTOR (Pato, 2026-11-14, on Me › Integrations:
-- "ONLY THESE ONES. BUT ACTUALLY MAKE THEM WORK").
--
-- One private connector URL per guest, the calendar feed's shape
-- (consumer_calendar_feeds, MESITA-3954): Claude and ChatGPT take a URL, and
-- the token in its path is the only key. Whoever holds it can search
-- Mesita's places and read that guest's reservations through the MCP
-- server — never write. The guest can make a new one (the old one stops).
--
-- Written by consumer-web-get-mcp-link (get-or-create, reset); read by
-- consumer-web-mcp (by token). Service role only. The 2026-07 table of the
-- same purpose (consumer_mcp_tokens) was dropped with the Second Stage.

create table if not exists public.consumer_mcp_links (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.consumer_mcp_links enable row level security;
revoke all on table public.consumer_mcp_links from anon, authenticated;
comment on table public.consumer_mcp_links is
  'MESITA-3971: each guest''s private MCP connector token (Me › Integrations › MCP). consumer-web-mcp reads places and that guest''s reservations by it. Service role only.';
