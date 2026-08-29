-- Atlas Super Categories (5–10; we ship the existing six families) plus
-- category membership (0–2 supers per category, intersections allowed).
-- places.family_keys stores the inferred Super Categories; NULL until enrich.
-- Search map Filters cut on Super Category, never on Category.

create table if not exists public.place_super_categories (
  slug text primary key,
  label text not null,
  emoji text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  constraint place_super_categories_sort_order_unique unique (sort_order)
);

comment on table public.place_super_categories is
  'Atlas Super Category vocabulary (5–10). A Super Category is a set of categories; a category may belong to two. Vocabulary. Client roles: SELECT only.';

create or replace function public.atlas_super_slugs_valid(slugs text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    slugs is not null
    and cardinality(slugs) <= 2
    and (select count(distinct x) from unnest(slugs) as x) = cardinality(slugs)
    and not exists (
      select 1
      from unnest(slugs) as s
      where not exists (
        select 1 from public.place_super_categories p
        where p.slug = s
      )
    );
$$;

comment on function public.atlas_super_slugs_valid(text[]) is
  'Atlas Super Category arrays: 0–2 unique slugs, each in place_super_categories.';

revoke execute on function public.atlas_super_slugs_valid(text[]) from public, anon, authenticated;
grant execute on function public.atlas_super_slugs_valid(text[]) to service_role;

alter table public.place_categories
  add column if not exists super_category_slugs text[] not null default '{}';

alter table public.place_categories
  drop constraint if exists place_categories_super_slugs_valid;

alter table public.place_categories
  add constraint place_categories_super_slugs_valid
  check (public.atlas_super_slugs_valid(super_category_slugs));

comment on column public.place_categories.super_category_slugs is
  '0–2 Atlas Super Category slugs. Empty = belongs to none. Two = an intersection.';

alter table public.places
  add column if not exists family_keys text[];

alter table public.places
  drop constraint if exists places_family_keys_valid;

alter table public.places
  add constraint places_family_keys_valid
  check (family_keys is null or public.atlas_super_slugs_valid(family_keys));

comment on column public.places.family_keys is
  'Inferred Super Categories (0–2). NULL / empty = undefined until contents enrichment.';

create or replace function public.seed_place_super_categories()
returns void
language sql
set search_path = ''
as $function$
  insert into public.place_super_categories (slug, label, emoji, sort_order) values
    ('restaurants',     'Restaurants',                  '🍽️', 1),
    ('bars_nightlife',  'Bars & Nightlife',             '🍸', 2),
    ('cafes_bakeries',  'Cafés, Bakeries & Dessert',    '☕', 3),
    ('wellness_spa',    'Wellness & Spa',               '🧖', 4),
    ('experiences',     'Experiences & Activities',     '🎟️', 5),
    ('culture_arts',    'Culture & Arts',               '🎭', 6)
  on conflict (slug) do update set
    label      = excluded.label,
    emoji      = excluded.emoji,
    sort_order = excluded.sort_order;
$function$;

comment on function public.seed_place_super_categories() is
  'Admin/reset seed for place_super_categories. Service-role only.';

revoke execute on function public.seed_place_super_categories() from public, anon, authenticated;
grant execute on function public.seed_place_super_categories() to service_role;

select public.seed_place_super_categories();

create or replace function public.seed_place_categories()
returns void
language plpgsql
set search_path = ''
as $function$
begin
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
    ('market', '🛒 Market', 'Experiences & Wellness', 101)
  on conflict (slug) do update set
    label      = excluded.label,
    section    = excluded.section,
    sort_order = excluded.sort_order;

  update public.place_categories set super_category_slugs = '{}'::text[];

  update public.place_categories set super_category_slugs = array['restaurants']
   where slug in (
     'mexican','taco','seafood','steak_house','italian','pizza','japanese','sushi',
     'ramen','chinese','thai','korean','vietnamese','indian','middle_eastern',
     'mediterranean','greek','spanish','french','american','argentinian','brazilian',
     'peruvian','asian_fusion','burger','sandwich','bbq','vegan','vegetarian','salad',
     'fast_food','fine_dining','food_truck','food_hall','deli'
   );

  update public.place_categories set super_category_slugs = array['cafes_bakeries']
   where slug in ('cafe','coffee_shop','bakery','dessert_shop','ice_cream','juice_bar');

  update public.place_categories set super_category_slugs = array['bars_nightlife']
   where slug in ('bar','pub','cocktail_bar','wine_bar','brewery','night_club');

  update public.place_categories set super_category_slugs = array['experiences']
   where slug in (
     'bowling_alley','escape_room','arcade','billiards','park','mini_golf','laser_tag',
     'axe_throwing','trampoline_park','go_kart','amusement_park','water_park','aquarium',
     'zoo','observation_deck','botanical_garden','market'
   );

  update public.place_categories set super_category_slugs = array['culture_arts']
   where slug in ('museum','art_gallery','theater','concert_venue','cultural_center');

  update public.place_categories set super_category_slugs = array['wellness_spa']
   where slug in (
     'gym','yoga_studio','pilates_studio','crossfit_box','climbing_gym','padel_club',
     'tennis_club','golf_course','soccer_field','swimming_pool','dance_studio',
     'martial_arts','spa','temazcal','hot_springs','massage','sauna','barbershop',
     'hair_salon','nail_salon','beauty_salon','wellness_center','tattoo_studio',
     'medical_spa'
   );

  update public.place_categories
     set super_category_slugs = array['restaurants','cafes_bakeries']
   where slug in ('breakfast','brunch');

  update public.place_categories
     set super_category_slugs = array['bars_nightlife','experiences']
   where slug in ('karaoke','casino','winery');

  update public.place_categories
     set super_category_slugs = array['cafes_bakeries','experiences']
   where slug = 'board_game_cafe';

  update public.place_categories
     set super_category_slugs = array['culture_arts','experiences']
   where slug = 'movie_theater';
end;
$function$;

comment on function public.seed_place_categories() is
  'Admin/reset seed for place_categories + Super Category membership. Service-role only.';

select public.seed_place_categories();

update public.places p
   set family_keys = nullif(c.super_category_slugs, '{}'::text[])
  from public.place_categories c
 where p.category = c.slug
   and p.family_keys is null;

alter table public.place_super_categories enable row level security;

drop policy if exists "place_super_categories_select_all" on public.place_super_categories;
create policy "place_super_categories_select_all" on public.place_super_categories
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, trigger, references
  on table public.place_super_categories
  from public, anon, authenticated;

grant select on table public.place_super_categories to anon, authenticated;
grant all on table public.place_super_categories to service_role;

insert into public.admin_reset_preserve (table_name, reason) values
  ('place_super_categories', 'super-category vocabulary — re-seeded on reset')
on conflict (table_name) do update set reason = excluded.reason;

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
      'project_plans',
      'place_categories',
      'place_super_categories',
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

  insert into public.project_plans (key, label, price_cents, currency) values
    ('pro',   'Partner', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  perform public.seed_place_super_categories();
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

create or replace view public.profiles
  with (security_invoker = true)
as
 select p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.vibe,
    p.price_level,
    u.listing_type,
    u.status,
    p.lat,
    p.lng,
    p.address,
    p.timezone,
    p.closes_at,
    p.phone,
    p.pitch,
    p.story,
    p.photos,
    p.website_url,
    p.instagram_url,
    p.facebook_url,
    p.whatsapp_url,
    p.opentable_url,
    p.resy_url,
    p.uber_eats_url,
    u.fiscal_type,
    u.plan,
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.email,
    p.hours,
    p.embedding,
    p.embedding_source_hash,
    p.country,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.whatsapp_pr_urls,
    p.instagram_pr_urls,
    p.google_business_url,
    p.google_stars_overall,
    p.google_review_count,
    p.google_visitor_count,
    p.mesita_stars_overall,
    p.mesita_stars_food,
    p.mesita_stars_service,
    p.mesita_stars_ambience,
    p.mesita_review_count,
    p.mesita_visitor_count,
    p.instagram_followers_count,
    u.segmentation_basic_enabled,
    u.segmentation_advanced_enabled,
    u.currency,
    p.menu_pdf_name,
    u.welcome_free_rate,
    u.welcome_premium_rate,
    u.free_rate,
    u.premium_rate,
    p.enriched_at,
    p.enrichment_sources,
    p.editorial_summary,
    p.zone,
    p.city,
    p.established_year,
    p.executive_chef,
    u.discount_cap_cents,
    p.facebook_rating,
    p.facebook_followers,
    p.mesita_stars_value,
    p.details,
    p.google_reviews,
    p.menus,
    p.popular_times,
    u.monthly_promo_cap,
    p.products,
    p.category_label,
    u.content_status,
    u.staff_channel_pinged_at,
    u.first_ticket_honored_at,
    u.plan_live_at,
    u.strike_count,
    u.last_strike_at,
    u.promo_paused_until,
    u.plan_forfeited_at,
    p.embedding_source_text,
    p.google_name,
    p.description_es,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.order_channel,
    p.order_target,
    p.business_status,
    p.business_status_at,
    p.name_embedding,
    p.name_embedding_hash,
    null::text as tiktok_url,
    null::text as tripadvisor_url,
    null::text as yelp_url,
    false as requires_story,
    p.request_count,
    p.family_keys
   from projects u
     join places p on p.id = u.id;

comment on view public.profiles is
  'SECURITY INVOKER join of projects ⋈ places. Dummy tiktok_url / tripadvisor_url / yelp_url / requires_story keep pre-redeploy EFs selecting; base tables no longer store them. INVARIANT: any create-or-replace MUST keep with (security_invoker = true).';

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  insert into public.places (
    id, created_at, updated_at, google_place_id, category, category_label,
    vibe, price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, email, hours, embedding,
    embedding_source_hash, embedding_source_text, country, description, menu_pdf_url, tags,
    whatsapp_pr_urls, instagram_pr_urls, google_business_url, google_stars_overall,
    google_review_count, google_visitor_count, mesita_stars_overall,
    mesita_stars_food, mesita_stars_service, mesita_stars_ambience,
    mesita_review_count, mesita_visitor_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, editorial_summary, zone, city,
    established_year, executive_chef, facebook_rating, facebook_followers,
    mesita_stars_value, details, google_reviews, menus, popular_times, products,
    google_name,
    description_es, mesita_name,
    reservation_channel, reservation_target, order_channel, order_target,
    business_status, business_status_at,
    name_embedding, name_embedding_hash,
    family_keys
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.vibe, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url, new.email,
    new.hours, new.embedding, new.embedding_source_hash, new.embedding_source_text, new.country,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    coalesce(new.whatsapp_pr_urls, '{}'), coalesce(new.instagram_pr_urls, '{}'),
    new.google_business_url, new.google_stars_overall, new.google_review_count,
    new.google_visitor_count, new.mesita_stars_overall, new.mesita_stars_food,
    new.mesita_stars_service, new.mesita_stars_ambience, new.mesita_review_count,
    new.mesita_visitor_count, new.instagram_followers_count, new.menu_pdf_name,
    new.enriched_at, new.enrichment_sources, new.editorial_summary, new.zone,
    new.city, new.established_year, new.executive_chef, new.facebook_rating,
    new.facebook_followers, new.mesita_stars_value, new.details, new.google_reviews,
    new.menus, new.popular_times, new.products,
    new.google_name, new.description_es,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target, new.order_channel, new.order_target,
    new.business_status, new.business_status_at,
    new.name_embedding, new.name_embedding_hash,
    new.family_keys
  ) returning id into v_id;

  insert into public.projects (
    id, created_at, updated_at, slug, status, listing_type, plan, fiscal_type,
    content_status, currency, segmentation_basic_enabled,
    segmentation_advanced_enabled, welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate, monthly_promo_cap, discount_cap_cents
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.status, 'lead'::public.project_status),
    coalesce(new.listing_type, 'web'::public.listing_type),
    coalesce(new.plan, 'free'::public.plan),
    coalesce(new.fiscal_type, 'formal'::public.project_fiscal_type),
    coalesce(new.content_status, 'queued'::public.content_status),
    coalesce(new.currency, 'MXN'),
    coalesce(new.segmentation_basic_enabled, true),
    coalesce(new.segmentation_advanced_enabled, false), new.welcome_free_rate,
    new.welcome_premium_rate, new.free_rate, new.premium_rate,
    new.monthly_promo_cap, new.discount_cap_cents
  );
  new.id := v_id;
  return new;
end
$function$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.places set
    google_place_id = new.google_place_id, category = new.category,
    category_label = new.category_label, vibe = new.vibe, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url,
    didi_food_url = new.didi_food_url, email = new.email, hours = new.hours,
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
    country = new.country, description = new.description, menu_pdf_url = new.menu_pdf_url,
    tags = new.tags, whatsapp_pr_urls = new.whatsapp_pr_urls,
    instagram_pr_urls = new.instagram_pr_urls, google_business_url = new.google_business_url,
    google_stars_overall = new.google_stars_overall, google_review_count = new.google_review_count,
    google_visitor_count = new.google_visitor_count, mesita_stars_overall = new.mesita_stars_overall,
    mesita_stars_food = new.mesita_stars_food, mesita_stars_service = new.mesita_stars_service,
    mesita_stars_ambience = new.mesita_stars_ambience, mesita_review_count = new.mesita_review_count,
    mesita_visitor_count = new.mesita_visitor_count, instagram_followers_count = new.instagram_followers_count,
    menu_pdf_name = new.menu_pdf_name, enriched_at = new.enriched_at,
    enrichment_sources = new.enrichment_sources, editorial_summary = new.editorial_summary,
    zone = new.zone, city = new.city, established_year = new.established_year,
    executive_chef = new.executive_chef, facebook_rating = new.facebook_rating,
    facebook_followers = new.facebook_followers, mesita_stars_value = new.mesita_stars_value,
    details = new.details, google_reviews = new.google_reviews, menus = new.menus,
    popular_times = new.popular_times, products = new.products,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    order_channel = new.order_channel,
    order_target = new.order_target,
    business_status = new.business_status,
    business_status_at = new.business_status_at,
    google_name = new.google_name,
    description_es = new.description_es,
    mesita_name = new.mesita_name,
    family_keys = new.family_keys
  where id = old.id;

  update public.projects set
    slug = new.slug, status = new.status, listing_type = new.listing_type,
    plan = new.plan, fiscal_type = new.fiscal_type, content_status = new.content_status,
    currency = new.currency,
    segmentation_basic_enabled = new.segmentation_basic_enabled,
    segmentation_advanced_enabled = new.segmentation_advanced_enabled,
    welcome_free_rate = new.welcome_free_rate, welcome_premium_rate = new.welcome_premium_rate,
    free_rate = new.free_rate, premium_rate = new.premium_rate,
    monthly_promo_cap = new.monthly_promo_cap, discount_cap_cents = new.discount_cap_cents
  where id = old.id;
  return new;
end
$function$;

grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

do $$
begin
  if not exists (
    select 1 from pg_class
     where oid = 'public.profiles'::regclass
       and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'public.profiles lost security_invoker=true';
  end if;
  if not has_table_privilege('anon', 'public.profiles', 'select') then
    raise exception 'anon lost SELECT on public.profiles';
  end if;
  if (
    select count(*) from pg_trigger t
     where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
  ) <> 2 then
    raise exception 'profiles lost an INSTEAD OF trigger';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name = 'family_keys'
  ) then
    raise exception 'places.family_keys missing';
  end if;
  if (select count(*) from public.place_super_categories) <> 6 then
    raise exception 'place_super_categories must seed exactly 6 rows';
  end if;
end $$;

notify pgrst, 'reload schema';
