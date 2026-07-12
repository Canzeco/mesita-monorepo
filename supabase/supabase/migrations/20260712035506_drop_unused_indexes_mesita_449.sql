-- MESITA-449: drop unused indexes that are safe after triage.
--
-- Perf advisor flagged 21 unused_index candidates (most tables empty / cold).
-- Keep FK-covering indexes (20260706092418), HNSW embedding, invite email
-- lookup, ordered list helpers, story/reservation partials, and anything that
-- looks like a uniqueness helper that is the UNIQUE constraint itself.
--
-- Drop only structurally redundant or proven-useless indexes:
--   • coupons_status_idx — low-cardinality status; every live query also
--     filters by consumer_id (served by coupons_consumer_idx /
--     coupons_one_active_per_project).
--   • project_subscriptions_project_idx — left-prefix already served by
--     partial-unique project_subscriptions_one_live (same pattern as
--     20260626220000_minimize_indexes dropping consumer_subscriptions_consumer_idx).
--   • consumer_mcp_tokens_hash_active_idx — non-unique partial on token_hash;
--     UNIQUE consumer_mcp_tokens_token_hash_key already covers MCP auth lookup
--     (.eq token_hash + revoked_at IS NULL filter).

drop index if exists public.coupons_status_idx;
drop index if exists public.project_subscriptions_project_idx;
drop index if exists public.consumer_mcp_tokens_hash_active_idx;
