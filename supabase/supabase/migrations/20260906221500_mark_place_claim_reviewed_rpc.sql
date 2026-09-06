-- MESITA-1544 follow-up — write-surface.test.ts's PROJECT allowlist is
-- empty on purpose: every real write to `projects` goes through a
-- parameterized door (place-doc.ts's writePlace(), or an atomic RPC like
-- claim_place_into_org). admin-web-decide-place-claim's "clear" decision
-- was a bare `.from("projects").update(...)`, caught by that ratchet.
-- Moved into its own RPC, same shape as claim/release.

create or replace function public.mark_place_claim_reviewed(
  p_place_id uuid,
  p_admin uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  update public.projects
     set claim_reviewed_at = now(),
         claim_reviewed_by = p_admin
   where id = p_place_id
     and organization_id is not null
     and claimed_by is not null
     and claim_reviewed_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_claimed_or_reviewed');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.mark_place_claim_reviewed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_place_claim_reviewed(uuid, uuid) to service_role;
