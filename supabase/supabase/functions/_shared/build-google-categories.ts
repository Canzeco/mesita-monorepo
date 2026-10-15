// One-shot generator. Run from the worktree:
//   deno run --allow-read --allow-write supabase/supabase/functions/_shared/build-google-categories.ts
// Writes google-categories.ts. The migration seeds the same rows.

const src = await Deno.readTextFile(
  new URL("./google-type-super.ts", import.meta.url),
);
const slugs = [...src.matchAll(/^\s{2}"([a-z0-9_]+)":/gm)].map((m) => m[1]);
if (slugs.length < 400) {
  throw new Error(`expected the Google Table A list, got ${slugs.length}`);
}

const EXACT: Record<string, string> = {
  acai_shop: "🫐",
  accounting: "📒",
  airport: "✈️",
  american_restaurant: "🍔",
  amusement_park: "🎢",
  aquarium: "🐠",
  art_gallery: "🖼️",
  art_museum: "🖼️",
  atm: "🏧",
  bakery: "🥐",
  bank: "🏦",
  bar: "🍸",
  barber_shop: "💈",
  barbecue_restaurant: "🍖",
  beach: "🏖️",
  beauty_salon: "💄",
  book_store: "📚",
  bowling_alley: "🎳",
  brazilian_restaurant: "🥩",
  brewery: "🍺",
  brewpub: "🍺",
  cafe: "☕",
  cake_shop: "🍰",
  candy_store: "🍬",
  casino: "🎰",
  chinese_restaurant: "🥡",
  chocolate_shop: "🍫",
  church: "⛪",
  clothing_store: "👗",
  cocktail_bar: "🍹",
  coffee_shop: "☕",
  comedy_club: "🎤",
  concert_hall: "🎶",
  convenience_store: "🏪",
  dentist: "🦷",
  dessert_shop: "🍮",
  donut_shop: "🍩",
  drugstore: "💊",
  fast_food_restaurant: "🍟",
  florist: "💐",
  french_restaurant: "🥐",
  gas_station: "⛽",
  greek_restaurant: "🥙",
  grocery_store: "🛒",
  gym: "🏋️",
  hair_salon: "💇",
  hamburger_restaurant: "🍔",
  hindu_temple: "🛕",
  hospital: "🏥",
  hotel: "🏨",
  ice_cream_shop: "🍨",
  indian_restaurant: "🍛",
  italian_restaurant: "🍝",
  japanese_restaurant: "🍱",
  juice_shop: "🧃",
  karaoke: "🎤",
  korean_restaurant: "🍲",
  library: "📚",
  liquor_store: "🍾",
  live_music_venue: "🎸",
  massage: "💆",
  mediterranean_restaurant: "🫒",
  mexican_restaurant: "🌮",
  middle_eastern_restaurant: "🧆",
  mosque: "🕌",
  movie_theater: "🎬",
  museum: "🏛️",
  nail_salon: "💅",
  night_club: "🪩",
  park: "🌳",
  pastry_shop: "🥐",
  pet_store: "🐾",
  pharmacy: "💊",
  pizza_restaurant: "🍕",
  pub: "🍻",
  ramen_restaurant: "🍜",
  restaurant: "🍽️",
  seafood_restaurant: "🦞",
  spa: "🧖",
  spanish_restaurant: "🥘",
  steak_house: "🥩",
  sushi_restaurant: "🍣",
  synagogue: "🕍",
  taco_restaurant: "🌮",
  tea_house: "🍵",
  thai_restaurant: "🍜",
  tourist_attraction: "📸",
  university: "🎓",
  vegan_restaurant: "🥗",
  vegetarian_restaurant: "🥗",
  vietnamese_restaurant: "🍜",
  wine_bar: "🍷",
  winery: "🍇",
  yoga_studio: "🧘",
  zoo: "🦁",
};

function emojiFor(slug: string): string {
  if (EXACT[slug]) return EXACT[slug];
  if (
    slug.endsWith("_restaurant") || slug === "bistro" || slug === "diner" ||
    slug === "gastropub" || slug === "deli" || slug === "food_court" ||
    slug === "cafeteria" || slug === "snack_bar" || slug === "meal_delivery" ||
    slug === "meal_takeaway" || slug === "food_store" || slug === "butcher_shop" ||
    slug === "catering_service" || slug === "food_delivery" || slug === "kebab_shop" ||
    slug === "noodle_shop" || slug === "salad_shop" || slug === "sandwich_shop" ||
    slug === "steak_house" || slug === "hot_dog_stand" || slug === "pizza_delivery"
  ) return "🍽️";
  if (
    slug.includes("cafe") || slug.includes("coffee") || slug.includes("tea") ||
    slug.includes("bakery") || slug.includes("bagel") || slug.includes("donut") ||
    slug.includes("pastry") || slug.includes("cake") || slug.includes("dessert") ||
    slug.includes("ice_cream") || slug.includes("chocolate") || slug.includes("candy") ||
    slug.includes("juice") || slug.includes("acai") || slug.includes("confection")
  ) return "☕";
  if (
    slug.includes("bar") || slug === "pub" || slug === "night_club" ||
    slug === "brewery" || slug === "brewpub" || slug === "winery" ||
    slug === "karaoke" || slug === "comedy_club" || slug === "dance_hall" ||
    slug === "live_music_venue" || slug === "casino"
  ) return "🍸";
  if (
    slug.includes("museum") || slug.includes("gallery") || slug.includes("theater") ||
    slug.includes("concert") || slug.includes("opera") || slug.includes("philharmonic") ||
    slug.includes("auditorium") || slug.includes("amphitheatre") ||
    slug.includes("cultural") || slug.includes("monument") || slug.includes("sculpture") ||
    slug.includes("castle") || slug.includes("historical") || slug.includes("fountain")
  ) return "🎭";
  if (
    slug.includes("gym") || slug.includes("fitness") || slug.includes("yoga") ||
    slug.includes("sport") || slug.includes("golf") || slug.includes("tennis") ||
    slug.includes("swim") || slug.includes("ski") || slug.includes("skate") ||
    slug.includes("athletic") || slug.includes("stadium") || slug.includes("arena") ||
    slug.includes("bowling")
  ) return "⚽";
  if (
    slug.includes("spa") || slug.includes("salon") || slug.includes("beauty") ||
    slug.includes("barber") || slug.includes("massage") || slug.includes("nail") ||
    slug.includes("sauna") || slug.includes("wellness") || slug.includes("tanning") ||
    slug.includes("skin_care") || slug.includes("makeup") || slug.includes("hair") ||
    slug.includes("foot_care") || slug.includes("body_art") || slug.includes("beautician")
  ) return "💆";
  if (
    slug.includes("park") || slug.includes("zoo") || slug.includes("aquarium") ||
    slug.includes("amusement") || slug.includes("beach") || slug.includes("garden") ||
    slug.includes("tourist") || slug.includes("hiking") || slug.includes("camp") ||
    slug.includes("playground") || slug.includes("marina") || slug.includes("plaza") ||
    slug.includes("picnic") || slug.includes("observation") || slug.includes("ferris") ||
    slug.includes("roller") || slug.includes("vineyard") || slug.includes("market") ||
    slug.includes("venue") || slug.includes("arcade") || slug.includes("paintball") ||
    slug.includes("kart") || slug.includes("fishing") || slug.includes("wildlife") ||
    slug.includes("planetarium") || slug.includes("visitor") || slug.includes("scenic") ||
    slug.includes("lake") || slug.includes("river") || slug.includes("mountain") ||
    slug.includes("island") || slug.includes("woods") || slug.includes("national_park")
  ) return "🎟️";
  if (
    slug.includes("hotel") || slug.includes("lodging") || slug.includes("inn") ||
    slug.includes("hostel") || slug.includes("motel") || slug.includes("guest") ||
    slug.includes("resort") || slug.includes("cottage") || slug.includes("farmstay") ||
    slug.includes("campground") || slug.includes("rv_park")
  ) return "🏨";
  if (
    slug.includes("store") || slug.includes("shop") || slug.includes("mall") ||
    slug.includes("supermarket") || slug.includes("hypermarket") || slug.includes("wholesaler")
  ) return "🛍️";
  if (
    slug.includes("hospital") || slug.includes("doctor") || slug.includes("dental") ||
    slug.includes("dentist") || slug.includes("pharmacy") || slug.includes("medical") ||
    slug.includes("clinic") || slug.includes("chiro") || slug.includes("physiotherapist") ||
    slug.includes("drugstore")
  ) return "🏥";
  if (
    slug.includes("school") || slug.includes("university") || slug.includes("library") ||
    slug.includes("preschool") || slug.includes("educational")
  ) return "🎓";
  if (slug.includes("bank") || slug === "atm" || slug.includes("accounting") || slug.includes("insurance")) {
    return "🏦";
  }
  if (
    slug.includes("airport") || slug.includes("station") || slug.includes("transit") ||
    slug.includes("bus_") || slug.includes("train") || slug.includes("subway") ||
    slug.includes("taxi") || slug.includes("parking") || slug.includes("gas_station") ||
    slug.includes("ferry") || slug.includes("airstrip") || slug.includes("heliport")
  ) return "🚉";
  if (
    slug.includes("church") || slug.includes("temple") || slug.includes("mosque") ||
    slug.includes("synagogue") || slug.includes("shrine")
  ) return "⛪";
  if (slug.includes("car_") || slug.includes("auto_") || slug.includes("truck")) return "🚗";
  if (slug.includes("apartment") || slug.includes("housing") || slug.includes("condominium") || slug.includes("building")) {
    return "🏢";
  }
  if (slug.includes("government") || slug.includes("courthouse") || slug.includes("embassy") || slug.includes("city_hall") || slug.includes("police")) {
    return "🏛️";
  }
  return "📍";
}

const ACRONYMS = new Set(["atm", "rv", "ev"]);

function labelFor(slug: string): string {
  return slug.split("_").map((word, i) => {
    if (ACRONYMS.has(word)) return word.toUpperCase();
    if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    return word;
  }).join(" ");
}

const rows = slugs.map((slug, i) => ({
  slug,
  label: labelFor(slug),
  emoji: emojiFor(slug),
  sort_order: i + 1,
}));

const missing = rows.filter((r) => !r.emoji || r.emoji.includes(" "));
if (missing.length) throw new Error(`bad emoji: ${missing.map((r) => r.slug).join(",")}`);

const ts = `// Google Places Table A categories. Each row is one Google type plus one emoji.
// Generated from google-type-super.ts. A place's category is one of these slugs.
// Places do not have families.

export type GoogleCategory = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

export const GOOGLE_CATEGORIES: readonly GoogleCategory[] = ${JSON.stringify(rows, null, 2)};

const BY_SLUG = new Map(GOOGLE_CATEGORIES.map((row) => [row.slug, row]));

/** Google's primary type, or a close slug, when it is one of Google's categories. */
export function categorySlugForGoogleType(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase().replace(/-/g, "_");
  if (!slug) return null;
  if (BY_SLUG.has(slug)) return slug;
  if (!slug.endsWith("_restaurant") && BY_SLUG.has(\`\${slug}_restaurant\`)) {
    return \`\${slug}_restaurant\`;
  }
  return null;
}

export function googleCategoryBySlug(slug: string | null | undefined): GoogleCategory | null {
  if (!slug) return null;
  return BY_SLUG.get(slug) ?? null;
}

/** The label a guest sees: one emoji, then Google's name. */
export function googleCategoryDisplay(slug: string | null | undefined): string | null {
  const row = googleCategoryBySlug(categorySlugForGoogleType(slug) ?? slug);
  if (!row) return null;
  return \`\${row.emoji} \${row.label}\`;
}
`;

await Deno.writeTextFile(new URL("./google-categories.ts", import.meta.url), ts);

const sql = `-- MESITA-2233 — a place's category is Google's category, with one emoji.
-- Places do not have a family.

-- The view and its INSTEAD OF triggers name family_keys. Drop them before the column.
drop view if exists public.profiles cascade;

alter table public.place_categories drop constraint if exists place_categories_family_keys_valid;
alter table public.place_profiles drop constraint if exists place_profiles_family_keys_valid;
alter table public.place_categories drop column if exists family_keys;
alter table public.place_profiles drop column if exists family_keys;

drop function if exists public.atlas_family_slugs_valid(text[]);
drop function if exists public.seed_place_families();

delete from public.admin_reset_preserve where table_name = 'place_families';
drop table if exists public.place_families;

alter table public.place_categories drop constraint if exists place_categories_section_check;
alter table public.place_categories add column if not exists emoji text;

create or replace function public.seed_place_categories()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  delete from public.place_categories
   where slug not in (
${rows.map((r) => `     '${r.slug}'`).join(",\n")}
   );

  insert into public.place_categories (slug, label, emoji, section, sort_order)
  values
${rows.map((r) => `  ('${r.slug}', '${r.label.replaceAll("'", "''")}', '${r.emoji}', 'Google', ${r.sort_order})`).join(",\n")}
  on conflict (slug) do update
    set label = excluded.label,
        emoji = excluded.emoji,
        section = excluded.section,
        sort_order = excluded.sort_order;

  delete from public.place_categories
   where slug not in (
${rows.map((r) => `     '${r.slug}'`).join(",\n")}
   );
end;
$fn$;

comment on function public.seed_place_categories() is
  'Google Places Table A categories. One emoji each. Service-role only.';

revoke all on function public.seed_place_categories() from public, anon, authenticated;
grant execute on function public.seed_place_categories() to service_role;

-- section is unused once families are gone. Keep the column; every row is Google.
update public.place_categories set section = 'Google' where section is distinct from 'Google';

select public.seed_place_categories();

update public.place_categories set section = 'Google';

-- Existing Mesita slugs become the Google type when one matches.
update public.place_profiles
   set category = replace(category, '-', '_')
 where category is not null
   and replace(category, '-', '_') in (select slug from public.place_categories)
   and category not in (select slug from public.place_categories);

update public.place_profiles
   set category = category || '_restaurant'
 where category is not null
   and category || '_restaurant' in (select slug from public.place_categories)
   and category not in (select slug from public.place_categories);

update public.place_profiles
   set category = null
 where category is not null
   and category not in (select slug from public.place_categories);

create or replace function public.sync_place_category_label()
returns trigger
language plpgsql
set search_path to ''
as $fn$
declare
  v_label text;
  v_emoji text;
begin
  if new.category is null or btrim(new.category) = '' then
    new.category_label := null;
    return new;
  end if;

  select pc.label, pc.emoji
    into v_label, v_emoji
    from public.place_categories pc
   where pc.slug = new.category
   limit 1;

  if v_label is null then
    new.category_label := initcap(replace(new.category, '_', ' '));
  elsif v_emoji is null or btrim(v_emoji) = '' then
    new.category_label := v_label;
  else
    new.category_label := v_emoji || ' ' || v_label;
  end if;

  return new;
end;
$fn$;

update public.place_profiles
   set category = category
 where category is not null;

-- admin reset no longer requires or reseeds a family table.
create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $fn$
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
      'place_categories',
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

  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
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
$fn$;

revoke all on function public.admin_reset_database() from public, anon, authenticated;
grant execute on function public.admin_reset_database() to service_role;

alter table public.place_categories alter column emoji set not null;

-- profiles is the browse view. Recreated without family_keys.
-- security_invoker stays on: omitting it would run the view as owner.

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $fn$
declare v_id uuid;
begin
  insert into public.place_profiles (
    id, created_at, updated_at, google_place_id, category, category_label,
    price_level, lat, lng, address, timezone, closes_at, phone, pitch, story,
    photos, website_url, instagram_url, facebook_url, whatsapp_url,
    opentable_url, resy_url, uber_eats_url, x_url, threads_url, reddit_url,
    google_maps_url, didi_food_url, hours, embedding,
    embedding_source_hash, embedding_source_text, description, menu_pdf_url, tags,
    google_stars_overall, google_review_count, instagram_followers_count,
    menu_pdf_name, enriched_at, enrichment_sources, zone, city,
    facebook_followers,
    google_reviews, menus, popular_times, products,
    google_name, mesita_name,
    reservation_channel, reservation_target,
    business_state, business_state_at,
    name_embedding, name_embedding_hash
  ) values (
    coalesce(new.id, gen_random_uuid()), coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()), new.google_place_id, new.category,
    new.category_label, new.price_level, new.lat, new.lng, new.address,
    new.timezone, new.closes_at, new.phone, new.pitch, new.story,
    coalesce(new.photos, '{}'), new.website_url, new.instagram_url,
    new.facebook_url, new.whatsapp_url, new.opentable_url, new.resy_url,
    new.uber_eats_url, new.x_url, new.threads_url, new.reddit_url,
    new.google_maps_url, new.didi_food_url,
    new.hours, new.embedding, new.embedding_source_hash, new.embedding_source_text,
    new.description, new.menu_pdf_url, coalesce(new.tags, '{}'),
    new.google_stars_overall, new.google_review_count, new.instagram_followers_count,
    new.menu_pdf_name, new.enriched_at, new.enrichment_sources,
    new.zone, new.city,
    new.facebook_followers,
    new.google_reviews, new.menus, new.popular_times, new.products,
    new.google_name,
    coalesce(new.mesita_name, new.name),
    new.reservation_channel, new.reservation_target,
    new.business_state, new.business_state_at,
    new.name_embedding, new.name_embedding_hash
  ) returning id into v_id;

  insert into public.places (
    id, created_at, updated_at, slug, state, content_state, currency
  ) values (
    v_id, coalesce(new.created_at, now()), coalesce(new.updated_at, now()),
    new.slug, coalesce(new.state, 'active'::public.place_state),
    coalesce(new.content_state, 'generating'::public.content_state),
    coalesce(new.currency, 'MXN')
  );
  new.id := v_id;
  return new;
end;
$fn$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $fn$
begin
  update public.place_profiles set
    google_place_id = new.google_place_id, category = new.category,
    category_label = new.category_label, price_level = new.price_level,
    lat = new.lat, lng = new.lng, address = new.address, timezone = new.timezone,
    closes_at = new.closes_at, phone = new.phone, pitch = new.pitch, story = new.story,
    photos = new.photos, website_url = new.website_url, instagram_url = new.instagram_url,
    facebook_url = new.facebook_url,
    whatsapp_url = new.whatsapp_url, opentable_url = new.opentable_url,
    resy_url = new.resy_url, uber_eats_url = new.uber_eats_url, x_url = new.x_url,
    threads_url = new.threads_url, reddit_url = new.reddit_url,
    google_maps_url = new.google_maps_url,
    didi_food_url = new.didi_food_url, hours = new.hours,
    embedding = new.embedding, embedding_source_hash = new.embedding_source_hash,
    embedding_source_text = new.embedding_source_text,
    name_embedding = new.name_embedding,
    name_embedding_hash = new.name_embedding_hash,
    description = new.description, menu_pdf_url = new.menu_pdf_url,
    tags = new.tags,
    google_stars_overall = new.google_stars_overall, google_review_count = new.google_review_count,
    instagram_followers_count = new.instagram_followers_count,
    menu_pdf_name = new.menu_pdf_name, enriched_at = new.enriched_at,
    enrichment_sources = new.enrichment_sources,
    zone = new.zone, city = new.city,
    facebook_followers = new.facebook_followers,
    google_reviews = new.google_reviews, menus = new.menus,
    popular_times = new.popular_times, products = new.products,
    reservation_channel = new.reservation_channel,
    reservation_target = new.reservation_target,
    business_state = new.business_state,
    business_state_at = new.business_state_at,
    google_name = new.google_name,
    mesita_name = new.mesita_name
  where id = old.id;
  update public.places set
    slug = new.slug, state = new.state, content_state = new.content_state,
    currency = new.currency
  where id = old.id;
  return new;
end
$fn$;

create view public.profiles with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.updated_at,
    p.google_place_id,
    u.slug,
    p.name,
    p.category,
    p.price_level,
    u.state,
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
    p.x_url,
    p.threads_url,
    p.reddit_url,
    p.google_maps_url,
    p.didi_food_url,
    p.hours,
    p.embedding,
    p.embedding_source_hash,
    p.description,
    p.menu_pdf_url,
    p.tags,
    p.google_stars_overall,
    p.google_review_count,
    p.instagram_followers_count,
    u.currency,
    p.menu_pdf_name,
    p.enriched_at,
    p.enrichment_sources,
    p.zone,
    p.city,
    p.facebook_followers,
    p.google_reviews,
    p.menus,
    p.popular_times,
    p.products,
    p.category_label,
    u.content_state,
    p.embedding_source_text,
    p.google_name,
    p.mesita_name,
    p.reservation_channel,
    p.reservation_target,
    p.business_state,
    p.business_state_at,
    p.name_embedding,
    p.name_embedding_hash,
    p.request_count,
    p.reservations_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to service_role;

create trigger profiles_insert_trg
  instead of insert on public.profiles
  for each row execute function public.profiles_insert();

create trigger profiles_update_trg
  instead of update on public.profiles
  for each row execute function public.profiles_update();
`;

await Deno.writeTextFile(
  new URL("../../migrations/20261015224000_google_categories_no_families.sql", import.meta.url),
  sql + "\n",
);

console.log(`wrote ${rows.length} categories`);
