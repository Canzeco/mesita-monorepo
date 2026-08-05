-- LEDGER STAMP — no DDL. Deliberately empty.
--
-- The live singleton's schema_migrations carries version 20260805193013 with
-- no file behind it. It is the server-side stamp the Supabase MCP wrote when
-- apply_migration ran place_google_name (column + projects_view append). The
-- statements are already mirrored in 20260805140000_place_google_name.sql.
-- Filing the stamp keeps `supabase db push` from refusing future migrations.

-- (no statements)
