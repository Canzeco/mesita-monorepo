-- MESITA-1857 — Super Categories become FAMILIES, in the database too.
--
-- The wire has said family for a month: `family_keys`, `familiesForPlace` and
-- `FamilyKey` shipped with MESITA-679. The catalog never followed, so the same
-- concept has carried two names ever since — `place_super_categories` /
-- `super_category_slugs` below the wire, `family` above it. This finishes it.
--
-- WHY NOW, WITHOUT EXPAND/CONTRACT. `place_super_categories` holds 8 rows,
-- `place_categories` 101 and `place_profiles` 1 (verified live 2026-09-15).
-- There is no traffic to strand between an old column and a new one, so the
-- honest rename is cheaper — and safer to read — than a compatibility shim
-- nobody would remember to retire.
--
-- THIS IS NOT A CREATE-COPY-DROP. `place_super_categories` carries `anon` and
-- `authenticated` SELECT, `service_role` ALL, `relrowsecurity = true` and the
-- policy `place_super_categories_select_all`. ALTER ... RENAME carries all of
-- those and the rows; a new table plus an INSERT ... SELECT carries none of
-- them, silently. Template followed line-for-line:
-- 20260906220000_places_becomes_place_profiles.sql.
--
-- WHAT DOES NOT FOLLOW THE RENAME, AND BREAKS SILENTLY IF MISSED.
--
--  1. FOUR function bodies. Postgres stores SQL and PL/pgSQL bodies as plain
--     TEXT in `pg_proc.prosrc` and does not dependency-track them, so every
--     one of these still COMPILES after the rename and throws 42P01 only at
--     CALL time:
--       · atlas_super_slugs_valid(text[]) — `language sql`, STABLE, string
--         body. It backs BOTH CHECK constraints, so a stale body means every
--         INSERT/UPDATE on `place_categories` and on `place_profiles.family_keys`
--         raises 42P01 while every SELECT stays perfectly clean. Rebuilt below
--         as `atlas_family_slugs_valid` in this same transaction, with both
--         constraints re-pointed at it before the old one is dropped.
--       · seed_place_super_categories() -> seed_place_families().
--       · seed_place_categories() — not the table, the COLUMN: its body writes
--         `super_category_slugs` eleven times. Missed by the issue; without it
--         Reset's category seeding breaks.
--       · admin_reset_database() — hard-codes 'place_super_categories' in
--         `missing_required` and calls seed_place_super_categories().
--
--  2. A DATA row. `public.admin_reset_preserve` names the table. It is
--     UPDATEd below, never INSERTed a second time: leave the stale row and it
--     still satisfies `missing_required`, `place_families` is not in
--     `keep_tables`, and Reset TRUNCATES the family vocabulary — every place's
--     `family_keys` becomes an orphan — before throwing on the missing seed.
--
--  3. Constraint, index and policy names. Index names are schema-unique and
--     none of the three follow their table.
--
-- KNOWN-UNSOUND, DELIBERATELY NOT FIXED HERE. Both CHECK constraints call a
-- STABLE function that reads ANOTHER table, so deleting a family row does not
-- re-validate the arrays already stored in `place_categories.family_keys` or
-- `place_profiles.family_keys`. A CHECK only fires on write of its own row.
-- That is already true today and this migration neither worsens nor fixes it;
-- the pgTAP orphan-key assertion is what actually catches the drift.

-- ── 1 · the table ───────────────────────────────────────────────────────────
alter table public.place_super_categories rename to place_families;

-- ── 2 · the column, so both sides spell membership the same way ────────────
-- `place_profiles.family_keys` has been correct since MESITA-679; this is the
-- category side catching up. The CHECK expression re-points itself (constraint
-- expressions store attnum, not the name); the function it CALLS does not, and
-- that is section 5.
alter table public.place_categories rename column super_category_slugs to family_keys;

-- ── 3 · constraints (renaming a constraint renames the index it owns) ──────
-- A loop, not a hardcoded list, for the reason the MESITA-1593 template
-- learned the hard way: when history and the live catalog disagree about what
-- exists, a bare RENAME hard-fails CI's from-scratch replay. Renaming whatever
-- the catalog actually carries is self-healing instead. `place_families_pkey`
-- and `place_families_sort_order_unique` are the only two here, and they own
-- the table's only two indexes, so no separate ALTER INDEX is needed.
do $$
declare r record;
begin
  for r in
    select conname,
           replace(conname, 'place_super_categories_', 'place_families_') as newname
      from pg_constraint
     where conrelid = 'public.place_families'::regclass
       and conname like 'place\_super\_categories\_%' escape '\'
  loop
    execute format('alter table public.place_families rename constraint %I to %I', r.conname, r.newname);
  end loop;
end $$;

-- ── 4 · the policy ─────────────────────────────────────────────────────────
-- ALTER POLICY has no IF EXISTS, so guard it. There are no non-internal
-- triggers on this table.
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'place_families'
       and policyname = 'place_super_categories_select_all'
  ) then
    alter policy "place_super_categories_select_all" on public.place_families
      rename to "place_families_select_all";
  end if;
end $$;

-- ── 5 · THE VALIDATOR — the one that fails only at CALL time ───────────────
-- Order matters: create the new function, re-point BOTH CHECK constraints at
-- it (a CHECK stores the function's OID, so it does not follow a `create or
-- replace` under a different name), and only then drop the old one. Doing it
-- the other way round would leave a window — inside this transaction, but
-- still — where a constraint references a function that no longer exists.
create or replace function public.atlas_family_slugs_valid(slugs text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    slugs is not null
    and cardinality(slugs) <= 2
    and (select count(distinct x) from unnest(slugs) as x) = cardinality(slugs)
    and not ('undefined' = any(slugs) and cardinality(slugs) > 1)
    and not exists (
      select 1
      from unnest(slugs) as s
      where not exists (
        select 1 from public.place_families p
        where p.slug = s
      )
    );
$$;

comment on function public.atlas_family_slugs_valid(text[]) is
  'Place family arrays: 0–2 unique catalog slugs from public.place_families; undefined only alone. STABLE and cross-table: it does not re-validate stored arrays when a family row is deleted (MESITA-1857).';

revoke execute on function public.atlas_family_slugs_valid(text[]) from public, anon, authenticated;
grant execute on function public.atlas_family_slugs_valid(text[]) to service_role;

alter table public.place_categories
  drop constraint if exists place_categories_super_slugs_valid;
alter table public.place_categories
  add constraint place_categories_family_keys_valid
  check (public.atlas_family_slugs_valid(family_keys));

alter table public.place_profiles
  drop constraint if exists place_profiles_family_keys_valid;
alter table public.place_profiles
  add constraint place_profiles_family_keys_valid
  check (family_keys is null or public.atlas_family_slugs_valid(family_keys));

drop function if exists public.atlas_super_slugs_valid(text[]);

-- ── 6 · the three remaining string bodies ──────────────────────────────────
-- Each is its LIVE definition (verified against pg_get_functiondef
-- 2026-09-15) with the old names swapped and nothing else touched. The seed
-- bodies come from 20260906213431_reset_seed_fns_satisfy_safeupdate.sql — the
-- `where true` clauses there are load-bearing, not noise: the `authenticator`
-- role preloads `safeupdate`, which aborts a bare UPDATE inside a SECURITY
-- DEFINER function called over RPC (MESITA-1589).

create or replace function public.seed_place_families()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_families set sort_order = sort_order + 1000 where true;
  insert into public.place_families (slug, label, emoji, sort_order) values
    ('restaurants',     'Restaurants',       '🍽️', 1),
    ('cafes_bakeries',  'Cafés & Desserts',  '☕', 2),
    ('bars_nightlife',  'Bars & Nightlife',  '🍸', 3),
    ('experiences',     'Experiences',       '🎟️', 4),
    ('culture_arts',    'Culture & Arts',    '🎭', 5),
    ('sports_fitness',  'Sports & Fitness',  '⚽', 6),
    ('wellness_beauty', 'Wellness & Beauty', '💆', 7),
    ('undefined',       'Undefined',         '❓', 999)
  on conflict (slug) do update set
    label      = excluded.label,
    emoji      = excluded.emoji,
    sort_order = excluded.sort_order;
  delete from public.place_families
   where slug not in (
     'restaurants','cafes_bakeries','bars_nightlife','experiences',
     'culture_arts','sports_fitness','wellness_beauty','undefined'
   );
end;
$function$;

comment on function public.seed_place_families() is
  'Admin/reset seed for place_families. Service-role only.';

revoke execute on function public.seed_place_families() from public, anon, authenticated;
grant execute on function public.seed_place_families() to service_role;

drop function if exists public.seed_place_super_categories();

-- Not named by the issue, and the one that would have broken Reset's category
-- seeding in silence: this body never touches the TABLE, only the COLUMN, and
-- it writes `super_category_slugs` eleven times.
create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path to ''
as $function$
begin
  update public.place_categories set family_keys = '{}'::text[] where true;

  insert into public.place_categories (slug, label, section, sort_order) values
    ('mexican', '🌮 Mexican', 'Food & Nightlife', 1),
    ('taco', '🌮 Tacos', 'Food & Nightlife', 2),
    ('seafood', '🦐 Seafood', 'Food & Nightlife', 3),
    ('steak_house', '🥩 Steakhouse', 'Food & Nightlife', 4),
    ('italian', '🍝 Italian', 'Food & Nightlife', 5),
    ('pizza', '🍕 Pizza', 'Food & Nightlife', 6),
    ('japanese', '🍱 Japanese', 'Food & Nightlife', 7),
    ('sushi', '🍣 Sushi', 'Food & Nightlife', 8),
    ('ramen', '🍜 Ramen', 'Food & Nightlife', 9),
    ('chinese', '🥡 Chinese', 'Food & Nightlife', 10),
    ('thai', '🌶️ Thai', 'Food & Nightlife', 11),
    ('korean', '🍲 Korean', 'Food & Nightlife', 12),
    ('vietnamese', '🍜 Vietnamese', 'Food & Nightlife', 13),
    ('indian', '🍛 Indian', 'Food & Nightlife', 14),
    ('middle_eastern', '🧆 Middle Eastern', 'Food & Nightlife', 15),
    ('mediterranean', '🫒 Mediterranean', 'Food & Nightlife', 16),
    ('greek', '🥙 Greek', 'Food & Nightlife', 17),
    ('spanish', '🥘 Spanish', 'Food & Nightlife', 18),
    ('french', '🥐 French', 'Food & Nightlife', 19),
    ('american', '🍟 American', 'Food & Nightlife', 20),
    ('argentinian', '🥩 Argentinian', 'Food & Nightlife', 21),
    ('brazilian', '🍖 Brazilian', 'Food & Nightlife', 22),
    ('peruvian', '🐟 Peruvian', 'Food & Nightlife', 23),
    ('asian_fusion', '🥢 Asian Fusion', 'Food & Nightlife', 24),
    ('burger', '🍔 Burgers', 'Food & Nightlife', 25),
    ('sandwich', '🥪 Sandwiches', 'Food & Nightlife', 26),
    ('bbq', '🍖 BBQ', 'Food & Nightlife', 27),
    ('breakfast', '🍳 Breakfast', 'Food & Nightlife', 28),
    ('brunch', '🥞 Brunch', 'Food & Nightlife', 29),
    ('vegan', '🌱 Vegan', 'Food & Nightlife', 30),
    ('vegetarian', '🥬 Vegetarian', 'Food & Nightlife', 31),
    ('salad', '🥗 Salads', 'Food & Nightlife', 33),
    ('fast_food', '🍟 Fast Food', 'Food & Nightlife', 34),
    ('fine_dining', '🍽️ Fine Dining', 'Food & Nightlife', 35),
    ('food_truck', '🚚 Food Truck', 'Food & Nightlife', 36),
    ('food_hall', '🍜 Food Hall', 'Food & Nightlife', 37),
    ('deli', '🥓 Deli', 'Food & Nightlife', 38),
    ('cafe', '☕ Café', 'Food & Nightlife', 39),
    ('coffee_shop', '☕ Coffee Shop', 'Food & Nightlife', 40),
    ('bakery', '🥐 Bakery', 'Food & Nightlife', 41),
    ('dessert_shop', '🍰 Desserts', 'Food & Nightlife', 42),
    ('ice_cream', '🍦 Ice Cream', 'Food & Nightlife', 43),
    ('juice_bar', '🧃 Juice Bar', 'Food & Nightlife', 44),
    ('bar', '🍺 Bar', 'Food & Nightlife', 45),
    ('pub', '🍺 Pub', 'Food & Nightlife', 46),
    ('cocktail_bar', '🍸 Cocktail Bar', 'Food & Nightlife', 47),
    ('wine_bar', '🍷 Wine Bar', 'Food & Nightlife', 48),
    ('brewery', '🍻 Brewery', 'Food & Nightlife', 49),
    ('night_club', '🪩 Nightclub', 'Food & Nightlife', 50),
    ('bowling_alley', '🎳 Bowling', 'Experiences & Wellness', 51),
    ('karaoke', '🎤 Karaoke', 'Experiences & Wellness', 52),
    ('escape_room', '🗝️ Escape Room', 'Experiences & Wellness', 53),
    ('arcade', '🕹️ Arcade', 'Experiences & Wellness', 54),
    ('billiards', '🎱 Billiards', 'Experiences & Wellness', 55),
    ('board_game_cafe', '🎲 Board Game Café', 'Experiences & Wellness', 56),
    ('park', '🌳 Park', 'Experiences & Wellness', 57),
    ('mini_golf', '⛳ Mini Golf', 'Experiences & Wellness', 58),
    ('laser_tag', '🔫 Laser Tag', 'Experiences & Wellness', 59),
    ('axe_throwing', '🪓 Axe Throwing', 'Experiences & Wellness', 60),
    ('trampoline_park', '🤸 Trampoline Park', 'Experiences & Wellness', 61),
    ('go_kart', '🏎️ Go-Karts', 'Experiences & Wellness', 62),
    ('movie_theater', '🎬 Movie Theater', 'Experiences & Wellness', 63),
    ('amusement_park', '🎡 Amusement Park', 'Experiences & Wellness', 64),
    ('water_park', '🌊 Water Park', 'Experiences & Wellness', 65),
    ('casino', '🎰 Casino', 'Experiences & Wellness', 66),
    ('gym', '💪 Gym', 'Experiences & Wellness', 67),
    ('yoga_studio', '🧘 Yoga Studio', 'Experiences & Wellness', 68),
    ('pilates_studio', '🧘 Pilates Studio', 'Experiences & Wellness', 69),
    ('crossfit_box', '🏋️ CrossFit', 'Experiences & Wellness', 70),
    ('climbing_gym', '🧗 Climbing Gym', 'Experiences & Wellness', 71),
    ('padel_club', '🎾 Padel Club', 'Experiences & Wellness', 72),
    ('tennis_club', '🎾 Tennis Club', 'Experiences & Wellness', 73),
    ('golf_course', '⛳ Golf Course', 'Experiences & Wellness', 74),
    ('soccer_field', '⚽ Soccer Field', 'Experiences & Wellness', 75),
    ('swimming_pool', '🏊 Swimming Pool', 'Experiences & Wellness', 76),
    ('dance_studio', '💃 Dance Studio', 'Experiences & Wellness', 77),
    ('martial_arts', '🥋 Martial Arts', 'Experiences & Wellness', 78),
    ('spa', '💆 Spa', 'Experiences & Wellness', 79),
    ('temazcal', '🔥 Temazcal', 'Experiences & Wellness', 80),
    ('hot_springs', '♨️ Hot Springs', 'Experiences & Wellness', 81),
    ('massage', '💆 Massage', 'Experiences & Wellness', 82),
    ('sauna', '🧖 Sauna', 'Experiences & Wellness', 83),
    ('barbershop', '💈 Barbershop', 'Experiences & Wellness', 84),
    ('hair_salon', '💇 Hair Salon', 'Experiences & Wellness', 85),
    ('nail_salon', '💅 Nail Salon', 'Experiences & Wellness', 86),
    ('beauty_salon', '💄 Beauty Salon', 'Experiences & Wellness', 87),
    ('wellness_center', '🌿 Wellness Center', 'Experiences & Wellness', 88),
    ('tattoo_studio', '🖋️ Tattoo Studio', 'Experiences & Wellness', 89),
    ('medical_spa', '💉 Medical Spa', 'Experiences & Wellness', 90),
    ('museum', '🏛️ Museum', 'Experiences & Wellness', 91),
    ('art_gallery', '🖼️ Art Gallery', 'Experiences & Wellness', 92),
    ('aquarium', '🐠 Aquarium', 'Experiences & Wellness', 93),
    ('zoo', '🦁 Zoo', 'Experiences & Wellness', 94),
    ('observation_deck', '🌆 Observation Deck', 'Experiences & Wellness', 95),
    ('winery', '🍷 Winery', 'Experiences & Wellness', 96),
    ('theater', '🎭 Theater', 'Experiences & Wellness', 97),
    ('concert_venue', '🎸 Concert Venue', 'Experiences & Wellness', 98),
    ('botanical_garden', '🌷 Botanical Garden', 'Experiences & Wellness', 99),
    ('cultural_center', '🎟️ Cultural Center', 'Experiences & Wellness', 100),
    ('market', '🛒 Market', 'Experiences & Wellness', 101),
    ('undefined', '❓ Undefined', 'Food & Nightlife', 999)
  on conflict (slug) do update set
    label      = excluded.label,
    section    = excluded.section,
    sort_order = excluded.sort_order;

  update public.place_categories set family_keys = array['restaurants']
   where slug in (
     'mexican','taco','seafood','steak_house','italian','pizza','japanese','sushi',
     'ramen','chinese','thai','korean','vietnamese','indian','middle_eastern',
     'mediterranean','greek','spanish','french','american','argentinian','brazilian',
     'peruvian','asian_fusion','burger','sandwich','bbq','vegan','vegetarian','salad',
     'fast_food','fine_dining','food_truck','food_hall','deli'
   );

  update public.place_categories set family_keys = array['cafes_bakeries']
   where slug in ('cafe','coffee_shop','bakery','dessert_shop','ice_cream','juice_bar');

  update public.place_categories set family_keys = array['bars_nightlife']
   where slug in ('bar','pub','cocktail_bar','wine_bar','brewery','night_club');

  update public.place_categories set family_keys = array['experiences']
   where slug in (
     'bowling_alley','escape_room','arcade','billiards','park','mini_golf','laser_tag',
     'axe_throwing','trampoline_park','go_kart','amusement_park','water_park','aquarium',
     'zoo','observation_deck','botanical_garden','market'
   );

  update public.place_categories set family_keys = array['culture_arts']
   where slug in ('museum','art_gallery','theater','concert_venue','cultural_center');

  update public.place_categories set family_keys = array['sports_fitness']
   where slug in (
     'padel_club','tennis_club','golf_course','soccer_field','swimming_pool',
     'climbing_gym','gym','crossfit_box','yoga_studio','pilates_studio',
     'dance_studio','martial_arts'
   );

  update public.place_categories set family_keys = array['wellness_beauty']
   where slug in (
     'spa','temazcal','hot_springs','massage','sauna','wellness_center','medical_spa',
     'barbershop','hair_salon','nail_salon','beauty_salon','tattoo_studio'
   );

  update public.place_categories
     set family_keys = array['restaurants','cafes_bakeries']
   where slug in ('breakfast','brunch');

  update public.place_categories
     set family_keys = array['bars_nightlife','experiences']
   where slug in ('karaoke','casino','winery');

  update public.place_categories
     set family_keys = array['cafes_bakeries','experiences']
   where slug = 'board_game_cafe';

  update public.place_categories
     set family_keys = array['experiences','culture_arts']
   where slug = 'movie_theater';

  update public.place_categories
     set family_keys = array['undefined']
   where slug = 'undefined';
end;
$function$;

create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables text[];
  wipe_tables text[];
  deleted_users bigint;
  missing_required text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_config',
      'super_admins',
      'classes',
      'consumer_plans',
      'place_plans',
      'place_categories',
      'place_families',
      'place_tags',
      'consumer_code_counter'
    ]) r
   where not (r = any (keep_tables));
  if missing_required is not null then
    raise exception
      'admin_reset_preserve is missing required survivor(s): %. Refusing to wipe.',
      missing_required;
  end if;

  if not exists (select 1 from public.super_admins) then
    raise exception
      'super_admins is empty: the wipe would delete every auth user, including yours, and leave nobody able to re-grant admin. Refusing to wipe.';
  end if;

  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  update public.classes set rank = -1 - rank where rank >= 0;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit)
  values
    ('bronze',  'Bronze',  0,  null,  2),
    ('silver',  'Silver',  1,  1000, 10),
    ('gold',    'Gold',    2,  5000, 10),
    ('diamond', 'Diamond', 3, 20000, 10)
  on conflict (key) do update set
    label = excluded.label,
    rank  = excluded.rank;

  delete from public.classes
   where key not in ('bronze', 'silver', 'gold', 'diamond');

  insert into public.consumer_plans (key, label, price_cents, currency) values
    ('free',    'Free',       0, 'MXN'),
    ('premium', 'Premium', 5000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  insert into public.place_plans (key, label, price_cents, currency) values
    ('pro',   'Partner', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  perform public.seed_place_families();
  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

-- ── 7 · the DATA row (an UPDATE — never a second INSERT) ───────────────────
update public.admin_reset_preserve
   set table_name = 'place_families',
       reason     = 'family vocabulary — re-seeded on reset'
 where table_name = 'place_super_categories';

-- ── 8 · what the names now mean ────────────────────────────────────────────
comment on table public.place_families is
  'Place family vocabulary — eight rows: seven guest pills plus `undefined`, always last (MESITA-1857, was `place_super_categories`). A family is a set of Atlas categories; a category may belong to two. Vocabulary. Client roles: SELECT only.';

comment on column public.place_categories.family_keys is
  '0–2 place family keys from public.place_families. Empty = belongs to none. Two = an intersection. Same spelling as place_profiles.family_keys on purpose.';

-- ── 9 · self-check: every object this migration owns actually moved ───────
-- Scoped to what this file renames, on purpose. A schema-WIDE sweep belongs in
-- pgTAP (schema_invariants.test.sql has one) where a surprise is a red test; a
-- surprise inside a migration is a replay that cannot finish and a `db push`
-- that is stuck for every worktree.
do $$
declare v_bad text;
begin
  select string_agg(x, ', ') into v_bad from (
    select 'table:place_super_categories'
      from pg_class
     where relnamespace = 'public'::regnamespace
       and relname = 'place_super_categories' and relkind in ('r', 'p')
    union all
    select 'column:place_categories.super_category_slugs'
      from pg_attribute
     where attrelid = 'public.place_categories'::regclass
       and attname = 'super_category_slugs' and attnum > 0 and not attisdropped
    union all
    select 'function:' || p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('atlas_super_slugs_valid', 'seed_place_super_categories')
    union all
    -- The whole reason this migration is careful: a string body compiles after
    -- the rename and 42P01s only when something CALLS it.
    select 'stale body:' || p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('atlas_family_slugs_valid', 'seed_place_families',
                         'seed_place_categories', 'admin_reset_database')
       and p.prosrc ~* 'super_categor'
    union all
    select 'admin_reset_preserve:' || table_name
      from public.admin_reset_preserve
     where table_name = 'place_super_categories'
    union all
    -- A CHECK stores the function OID, so it does not follow a rebuild under a
    -- new name. Missing this is how SELECTs stay clean while writes die.
    select 'constraint still on the old validator:' || conname
      from pg_constraint
     where conname in ('place_categories_family_keys_valid',
                       'place_profiles_family_keys_valid')
       and pg_get_constraintdef(oid) not like '%atlas_family_slugs_valid%'
  ) s;
  if v_bad is not null then
    raise exception 'MESITA-1857 rename is half-done: %', v_bad;
  end if;
end $$;

-- ── 10 · LAST LINE ─────────────────────────────────────────────────────────
-- Without it `.from("place_families")` 404s until PostgREST's schema cache
-- turns over on its own. Every prior rename in this repo ends this way.
notify pgrst, 'reload schema';
