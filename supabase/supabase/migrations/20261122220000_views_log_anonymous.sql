-- MESITA-4678 (Pato, 2026-11-22: "Anonymous users cannot be customers. however
-- the log events for views can count for anonymous. Just mention Anonymous
-- user"). Business Views' log now lists a signed-out open (a place_events
-- view with no consumer, MESITA-4326) as its own row: no person columns,
-- anonymous = true, no Instagram mark and no customer key, so ?customer=
-- never matches it and it never becomes a customer. Same signature and
-- return table as 20261122200000; only the join and the null-consumer guard
-- change.

create or replace function public.place_views_log(
  p_place_id uuid,
  p_before timestamptz default null,
  p_limit integer default 31,
  p_customer text default null
) returns table (
  consumer_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer,
  guest_class text,
  plan text,
  anonymous boolean,
  instagram boolean,
  customer text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at,
         c.first_name,
         case when v.shown then c.avatar_url end,
         case when c.id is not null then public.place_shown_handle(c) end,
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
         not v.named,
         v.shown
           and c.instagram_handle is not null
           and c.instagram_verified_at is not null,
         public.place_customer_key(p_place_id, e.consumer_id)
    from public.place_views_events(p_place_id) e
    left join public.consumers c on c.id = e.consumer_id
    cross join lateral (
      select c.id is not null and public.place_activity_visible(c) as named,
             c.id is not null and not c.appear_anonymous as shown
    ) v
   where (e.consumer_id is null or c.id is not null)
     and (p_before is null or e.created_at < p_before)
     and (p_customer is null or public.place_customer_key(p_place_id, e.consumer_id) = p_customer)
   order by e.created_at desc, e.kind
   limit least(greatest(p_limit, 1), 200)
$$;

comment on function public.place_views_log(uuid, timestamptz, integer, text) is
  'MESITA-3213: Business Views'' log, newest first. Who is named follows place_activity_feed; the handle by place_shown_handle (MESITA-4659: opt-in). MESITA-4538: the per-place customer key out, an optional customer filter in. MESITA-4678: a signed-out open is a row with no person and no customer key. service_role only.';

revoke execute on function public.place_views_log(uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.place_views_log(uuid, timestamptz, integer, text) to service_role;
