-- MESITA-2580: Social shows members without Instagram, anonymously.
--
-- Before: the feed held only members with a verified Instagram
-- (place_activity_visible), about 10% of members, so Social was nearly empty.
-- Now every non-deleted member's liked/viewed events are in the feed. A member
-- without a verified Instagram is anonymous: every identifying field is null
-- HERE, in SQL, so nothing that names them leaves the database, and
-- `anonymous` says so. The app draws them as "A member".
--
-- place_activity_people (the line under a place's title) is unchanged: it
-- still names only members place_activity_visible lets through.

drop function if exists public.place_activity_feed(integer);
create function public.place_activity_feed(
  p_limit integer default 200
) returns table (
  consumer_id uuid,
  place_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer,
  guest_class text,
  plan text,
  anonymous boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         case when v.named then c.first_name end,
         case when v.named then c.avatar_url end,
         case when v.named then c.instagram_handle end,
         case when v.named then c.instagram_followers_count end,
         case when v.named then c.guest_class end,
         case when v.named then c.plan end,
         not v.named
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
    cross join lateral (select public.place_activity_visible(c) as named) v
   where not a.quiet
     and c.deleted_at is null
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;
