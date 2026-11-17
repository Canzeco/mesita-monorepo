-- MESITA-4263 — VIP needs a PUBLIC Instagram AND more than 1,000 followers.
-- Pato, 2026-11-17: "SUPER IMPORTANT TO BE VIP CLASS. +1000 FOLLOWERS.
-- PUBLIC INSTAGRAM ACCOUNT. BOTH MUST BE TRUE". Reverses MESITA-3864's
-- "privacy does not matter".
--
-- instagram_is_private is what the Apify profile scrape last said (its
-- `private` field), written by the same connect and sync that write the
-- follower count. Null = not known (never scraped since, or the Meta DM
-- connect, which cannot see it) and is NOT public: no VIP until a sync says so.

alter table public.consumers add column instagram_is_private boolean;

comment on column public.consumers.instagram_is_private is
  'MESITA-4263: the linked Instagram is private, as the last profile scrape said; null = not known. VIP needs false.';

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) > 1000
       and instagram_is_private = false
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-4249, MESITA-4263): vip exactly when Instagram is verified, has more than 1,000 followers and is public, else regular. Generated; nothing writes it.';

-- The writers take the privacy too. A default keeps every older caller (and
-- the EF that still sends three arguments while it redeploys) working; it
-- writes null, which is not VIP.
drop function public.consumer_instagram_verify(uuid, text, integer);
create function public.consumer_instagram_verify(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer,
  p_private boolean default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consumers
     set instagram_handle = null,
         instagram_followers_count = null,
         instagram_is_private = null,
         instagram_verified_at = null
   where instagram_handle = p_handle
     and id <> p_consumer_id;

  update public.consumers
     set instagram_handle = p_handle,
         instagram_followers_count = p_followers,
         instagram_is_private = p_private,
         instagram_verified_at = now()
   where id = p_consumer_id;
  if not found then
    raise exception 'consumer % not found', p_consumer_id;
  end if;

  delete from public.consumer_instagram_claims
   where consumer_id = p_consumer_id;
end;
$$;

drop function public.consumer_instagram_sync(uuid, text, integer);
create function public.consumer_instagram_sync(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer,
  p_private boolean default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consumers
     set instagram_followers_count = p_followers,
         instagram_is_private = p_private,
         instagram_synced_at = now()
   where id = p_consumer_id
     and instagram_handle = p_handle
     and deleted_at is null;
  return found;
end;
$$;

revoke execute on function public.consumer_instagram_verify(uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_verify(uuid, text, integer, boolean) to service_role;
revoke execute on function public.consumer_instagram_sync(uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_sync(uuid, text, integer, boolean) to service_role;
