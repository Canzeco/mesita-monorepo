-- Mirrored from an MCP apply_migration stamp that landed on prod without a
-- repo file (20260712035218). That apply incorrectly flipped projects_view to
-- security_invoker=true — Product Rules keep it SECURITY DEFINER (accepted
-- advisor 0010). 20260712040000 recreates the view with security_invoker=false
-- and adds Buzz v4 membership columns.
--
-- Kept here only so `supabase db push` history matches remote.

alter view public.projects_view set (security_invoker = true);
