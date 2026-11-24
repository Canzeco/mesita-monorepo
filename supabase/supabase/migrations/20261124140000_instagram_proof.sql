-- MESITA-4856 — Sharing Instagram needs proof the account is yours. Pato,
-- 2026-11-24: "Yes, require proof". instagram_verified_at is also stamped by a
-- typed, trusted username (MESITA-3039), so it proves nothing.
--
-- 1. consumers.instagram_proved_at: stamped only by a proof, Mesita's DM or
--    the one-time code in the bio. Nobody is backfilled: no proof is on record.
-- 2. consumer_instagram_verify takes p_proved (default false, so an old caller
--    never proves). An unproved connect is refused when another account proved
--    the handle; it keeps a proof only for the same handle.
-- 3. consumer_social_level: the instagram level needs the proof.
--
-- Rollback: 20261124113000's level; 20261122200000's verify; drop the column.

alter table public.consumers add column instagram_proved_at timestamptz;

comment on column public.consumers.instagram_proved_at is
  'MESITA-4856: when this guest proved they own instagram_handle (Mesita DM or bio code). Sharing needs it (consumer_social_level). Meaningless without a handle; a new handle resets it. Written only by consumer_instagram_verify.';

create or replace function public.consumer_social_level(c public.consumers)
returns text
language sql
stable
as $$
  select case
           when c.social_private
             or c.birth_year is null
             or extract(year from now() at time zone 'utc')::integer - c.birth_year < 19
             then 'private'
           when c.instagram_handle is not null
            and c.instagram_verified_at is not null
            and c.instagram_proved_at is not null
            and c.instagram_handle_shown is true
             then 'instagram'
           else 'public'
         end
$$;

drop function public.consumer_instagram_verify(uuid, text, integer, boolean);

create function public.consumer_instagram_verify(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer,
  p_private boolean default null,
  p_proved boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- One connect per handle at a time, so the check below cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('instagram_handle:' || p_handle, 0));

  if not p_proved and exists (
    select 1 from public.consumers
     where instagram_handle = p_handle
       and instagram_proved_at is not null
       and deleted_at is null
       and id <> p_consumer_id
  ) then
    raise exception 'handle_proved_elsewhere';
  end if;

  update public.consumers
     set instagram_handle = null,
         instagram_followers_count = null,
         instagram_is_private = null,
         instagram_verified_at = null,
         instagram_proved_at = null,
         instagram_handle_shown = null
   where instagram_handle = p_handle
     and id <> p_consumer_id;

  update public.consumers
     set instagram_handle_shown = case
           when instagram_handle is distinct from p_handle then null
           else instagram_handle_shown
         end,
         instagram_proved_at = case
           when p_proved then now()
           when instagram_handle is distinct from p_handle then null
           else instagram_proved_at
         end,
         instagram_handle = p_handle,
         instagram_followers_count = p_followers,
         instagram_is_private = p_private,
         instagram_verified_at = now(),
         instagram_synced_at = now()
   where id = p_consumer_id;
  if not found then
    raise exception 'consumer % not found', p_consumer_id;
  end if;

  delete from public.consumer_instagram_claims
   where consumer_id = p_consumer_id;
end;
$$;

revoke execute on function public.consumer_instagram_verify(uuid, text, integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_verify(uuid, text, integer, boolean, boolean) to service_role;
