-- The settled vocabulary, applied to storage.
--   consumer (guest in copy) · manager · administrator
--   project · place · profile
--   visit ticket · reservation ticket · order ticket
--   favorites. No coupon.
-- `projects` deliberately STAYS: it is the more standard software word, and
-- keeping it deletes the 13-table project_id rename.

-- ---- types: the column already used the right word, the type never caught up
alter type public.membership         rename to plan;
alter type public.content_gen_status rename to content_status;

-- ---- tables
alter table public.accounts                   rename to managers;
alter table public.account_invites            rename to project_invites;
alter table public.tickets                    rename to visit_tickets;
alter table public.reservations               rename to reservation_tickets;
alter table public.saved_places               rename to favorites;
alter table public.membership_strikes         rename to project_strikes;
alter table public.business_plans             rename to project_plans;
alter table public.consumer_mcp_tokens        rename to consumer_connectors;
alter table public.consumer_pay_notifications rename to consumer_notifications;
alter table public.app_settings               rename to app_config;

-- ---- the view. RENAME, never drop+recreate: rename preserves the definition,
-- the INSTEAD OF triggers, every grant, and security_invoker = true. A rebuild
-- from a repo migration copy silently drops columns added by later migrations,
-- because those trigger bodies are cumulative.
alter view public.projects_view rename to profiles;

alter function public.projects_view_insert() rename to profiles_insert;
alter function public.projects_view_update() rename to profiles_update;
alter function public.projects_view_delete() rename to profiles_delete;

alter trigger projects_view_insert_trg on public.profiles rename to profiles_insert_trg;
alter trigger projects_view_update_trg on public.profiles rename to profiles_update_trg;

-- ---- columns
-- These four are visibility switches. They CONTROL a profile; they are not one.
-- With `profile` now naming the project's published face, the word had to move.
alter table public.consumers rename column profile_public       to privacy_public;
alter table public.consumers rename column profile_show_saves   to privacy_show_saves;
alter table public.consumers rename column profile_show_visits  to privacy_show_visits;
alter table public.consumers rename column profile_show_stories to privacy_show_stories;

-- The only column in the schema prefixed with its own table name.
-- places.instagram_followers_count shows the correct form.
alter table public.consumers
  rename column consumer_instagram_followers_count to instagram_followers_count;

-- `check` meant two things inside one table: check_code is the Mesita Check QR,
-- check_subtotal_cents is la cuenta. The same table already had bill_source, so
-- the schema solved this once and forgot. check_ is now reserved for the staff app.
alter table public.visit_tickets rename column check_subtotal_cents to bill_subtotal_cents;

-- guest is the VOICE layer and belongs in copy; this table says consumer_id two
-- columns away. business_number named an entity that does not exist.
alter table public.reservation_tickets rename column guest_confirmed_at to consumer_confirmed_at;
alter table public.reservation_tickets rename column guest_notify       to consumer_notify;
alter table public.reservation_tickets rename column business_number    to place_phone;
alter table public.reservation_tickets rename column consumer_number    to consumer_phone;

-- Two spellings of one word in two tables, joined by a trigger that read one
-- and wrote the other. places already says ambience.
alter table public.ticket_reviews rename column ambiance to ambience;

-- reward / promo / discount were three words for one idea, and projects carried
-- two of them as separate columns. Survivors: promo = the offer a project
-- configures, discount = the money a guest gets. reward is retired.
alter table public.projects rename column reward_cap_cents to discount_cap_cents;

-- membership is not the word. plan is.
alter table public.projects rename column membership_live_at      to plan_live_at;
alter table public.projects rename column membership_forfeited_at to plan_forfeited_at;

-- ---- patch the plpgsql that renames cannot follow.
-- plpgsql bodies are late-bound: a rename does not touch them, and the break
-- only surfaces at runtime. Patch off the LIVE definition (pg_get_functiondef),
-- never off a repo copy — profiles_insert/update are re-declared by every
-- migration that adds a places column, so the live body is the cumulative merge.
do $patch$
declare d text;
begin
  for d in
    select pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('profiles_insert', 'profiles_update')
  loop
    execute replace(d, 'reward_cap_cents', 'discount_cap_cents');
  end loop;
end
$patch$;

create or replace function public.is_project_member(p_project_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project_id
      and m.manager_id = (select auth.uid())
  );
$function$;

create or replace function public.refresh_place_mesita_reviews(p_project_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.places p
  set mesita_review_count   = agg.n,
      -- numeric(2,1) columns: round to the one decimal they can hold, else
      -- the assignment rounds implicitly and the intent is invisible.
      mesita_stars_overall  = round(agg.overall::numeric, 1),
      mesita_stars_food     = round(agg.food::numeric, 1),
      mesita_stars_service  = round(agg.service::numeric, 1),
      mesita_stars_ambience = round(agg.ambience::numeric, 1),
      -- `value` is the only nullable sub-score on ticket_reviews (added after
      -- the first reviews shipped), so avg() legitimately returns NULL here
      -- even when n > 0.
      mesita_stars_value    = agg.value
  from (
    -- Scalar aggregate, no GROUP BY — always yields exactly one row, so the
    -- "last review deleted" case falls out for free: n = 0 and every avg() is
    -- NULL, which clears the stars instead of freezing the last average.
    select
      count(*)        as n,
      avg(r.overall)  as overall,
      avg(r.food)     as food,
      avg(r.service)  as service,
      avg(r.ambience) as ambience,
      avg(r.value)    as value
    from public.ticket_reviews r
    where r.project_id = p_project_id
  ) agg
  where p.id = p_project_id;
end;
$function$;
