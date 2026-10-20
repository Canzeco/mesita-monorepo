-- MESITA-2461 — an Instagram handle is proved, not typed.
--
-- Before: consumer-web-claim-instagram stored whatever handle and follower
-- count the client sent, and Social showed every member with a handle, so
-- anyone could appear in the feed as @someone_famous.
--
-- Now (decision on MESITA-2461): the member puts a one-time code in their
-- Instagram bio; the EF scrapes the profile and, only if the code is there,
-- stores the handle, the SCRAPED follower count and instagram_verified_at.
--
-- Live data at write time: 1 consumer, 0 handles, so the CHECK below needs
-- no backfill.

alter table public.consumers
  add column if not exists instagram_verified_at timestamptz;

comment on column public.consumers.instagram_verified_at is
  'MESITA-2461: when the member proved the handle (the one-time code was in their Instagram bio). A handle is never stored without it.';

alter table public.consumers
  add constraint consumers_instagram_handle_verified_check
  check (instagram_handle is null or instagram_verified_at is not null);

-- The pending claim: one per member, EF-only like place_activity.
create table public.consumer_instagram_claims (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9._]{1,30}$'),
  code text not null check (code ~ '^MESITA-[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

comment on table public.consumer_instagram_claims is
  'MESITA-2461: a pending Instagram claim — the handle and the one-time code the member must put in their bio. EF-only (RLS, no policies; client privileges revoked).';

alter table public.consumer_instagram_claims enable row level security;
revoke all on table public.consumer_instagram_claims from public, anon, authenticated;
grant all on table public.consumer_instagram_claims to service_role;

-- The verify write, atomic: a handle belongs to the last account that proved
-- it, so it comes off any other account first; then this member gets the
-- handle, the scraped count and the stamp; the claim is spent.
create or replace function public.consumer_instagram_verify(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consumers
     set instagram_handle = null,
         instagram_followers_count = null,
         instagram_verified_at = null
   where instagram_handle = p_handle
     and id <> p_consumer_id;

  update public.consumers
     set instagram_handle = p_handle,
         instagram_followers_count = p_followers,
         instagram_verified_at = now()
   where id = p_consumer_id;
  if not found then
    raise exception 'consumer % not found', p_consumer_id;
  end if;

  delete from public.consumer_instagram_claims
   where consumer_id = p_consumer_id;
end;
$$;

revoke execute on function public.consumer_instagram_verify(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consumer_instagram_verify(uuid, text, integer) to service_role;

-- Who may appear in Social: a VERIFIED handle (the CHECK already implies it;
-- the rule says it out loud so it never depends on that).
create or replace function public.place_activity_visible(c public.consumers)
returns boolean
language sql
immutable
as $$
  select c.instagram_handle is not null
     and c.instagram_verified_at is not null
     and c.show_activity
     and c.deleted_at is null
$$;
