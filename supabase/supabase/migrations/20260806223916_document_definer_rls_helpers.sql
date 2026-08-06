-- MESITA-941: document intentional authenticated EXECUTE on RLS helper DEFINER
-- functions (advisor 0029). Do NOT revoke — Storage RLS policies on place_images
-- / menu_* buckets call these as the signed-in user.
--
-- Also document the deliberate rls_enabled_no_policy posture: EF-only tables
-- keep RLS on with zero policies so PostgREST clients see nothing; adding a
-- policy would OPEN access. service_role EFs bypass RLS.

comment on function public.is_super_admin() is
  'SECURITY DEFINER helper: true when auth.uid() email is in public.super_admins. EXECUTE granted to authenticated intentionally — Storage RLS policies call it as the signed-in user (advisor 0029 accepted). Not a product RPC.';

comment on function public.is_project_member(uuid) is
  'SECURITY DEFINER helper: true when auth.uid() is a project_members row for p_project_id. EXECUTE granted to authenticated intentionally — Storage RLS policies call it as the signed-in user (advisor 0029 accepted). Not a product RPC.';

comment on table public.accounts is
  'EF-only table: RLS enabled with no policies (deliberate lockdown — clients never touch it). service_role EFs bypass RLS.';

comment on table public.tickets is
  'EF-only table: RLS enabled with no policies (deliberate lockdown). Ticket workflows go through Edge Functions.';

comment on table public.reservations is
  'EF-only table: RLS enabled with no policies (deliberate lockdown). Reservation workflows go through Edge Functions.';

comment on table public.super_admins is
  'EF-only allowlist: RLS enabled with no policies (deliberate lockdown). Checked via is_super_admin() / service_role EFs.';

comment on table public.app_settings is
  'EF-only singleton: RLS enabled with no policies (deliberate lockdown). Admin console configs bind every serving path.';

comment on table public.reward_rules is
  'EF-only rewards grid (v8 SoT): RLS enabled with no policies (deliberate lockdown). Survives admin_reset via admin_reset_preserve.';
