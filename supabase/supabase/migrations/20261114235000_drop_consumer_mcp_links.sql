-- MESITA-3976 (Pato, 2026-11-14: "I don't really want an MCP rn. just leave
-- it as soon in the pro plan"): the MCP connector of MESITA-3971 is gone, and
-- its tokens with it. Two links were made; no assistant ever used one.
drop table if exists public.consumer_mcp_links;
