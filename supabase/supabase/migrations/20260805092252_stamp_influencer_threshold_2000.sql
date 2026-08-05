-- LEDGER STAMP — no DDL. Deliberately empty.
--
-- Supabase MCP applied an earlier influencer_threshold_2000 pass as version
-- 20260805092252 without a matching repo file. Filing the stamp keeps
-- `supabase db push` from refusing future migrations. The live DDL for the
-- 2,000 bar is MESITA-911: 20260805195617_influencer_follower_threshold_2000.

-- (no statements)
