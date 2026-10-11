-- SCHEMA RESIDUE CUT (MESITA-2145 · step 2 of MESITA-2144 · P-MESITA-29).
--
-- "kill the unused supabase tables / columns / functions". After the First
-- Stage cut (MESITA-2091) and the dead-code sweep (MESITA-2136), an audit
-- covered every surviving object, with one auditor and two refuting skeptics
-- per slice. This file drops what nothing reads anymore. MESITA-2144 already
-- removed every code reader and writer; the dropped-column and dropped-table
-- guards in _shared pin that. The live DB holds 0 places, 0 consumers and
-- 0 tickets, so nothing here can lose data.
--
-- What goes:
--   · place_name_history: table, trigger and function. Its only reader was a
--     dead search mode.
--   · scheduled re-enrichment: queue_due_place_enrichments(), its cron job,
--     place_profiles.enrich_every_days / enrich_mode / enrich_next_at.
--     Nothing could set a schedule.
--   · place_profiles.vibe, email, country, details, editorial_summary,
--     established_year, executive_chef, facebook_rating. The enricher wrote
--     them; no screen, agent or ranking read them.
--   · consumer_notifications.state / resolved_at, consumers.country,
--     super_admins.phone, place_tags.section, reservation_tickets.completed_at.
--   · enum labels nothing writes: place_state lead / pending_review /
--     pending_verification, content_state queued, reservation_state no_show.
--     The old column defaults ('lead', 'queued') were the only writers;
--     save-place always sets state='active' and an explicit content_state.
--   · dead app_config JSON keys (see step 9).
--
-- Kept on purpose (MESITA-2144 decision): pipeline runs/events, the media
-- ledger, ticket timestamps and conversation ids, analytics events (records
-- people query by hand); the profiles INSERT trigger (seed.sql writes through
-- the view); the HNSW indexes (pinned by schema_invariants).
--
-- Merge only after MESITA-2144's Edge Function deploy is green.

-- Every table this file rewrites, locked up front in one fixed order, so a
-- busy function makes the cut wait at most 20s and fail cleanly instead of
-- deadlocking halfway. Inside a DO block because a top-level LOCK TABLE errors
-- when the runner does not open an explicit transaction.
do $lock_hot_tables$
begin
  perform set_config('lock_timeout', '20s', true);
  lock table public.app_config, public.places, public.place_profiles,
    public.reservation_tickets, public.consumer_notifications,
    public.consumers, public.super_admins, public.place_tags
    in access exclusive mode;
end $lock_hot_tables$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. SCHEDULED RE-ENRICHMENT
-- ══════════════════════════════════════════════════════════════════════════
-- Unschedule first, or the job would call a dropped function every 15
-- minutes. Guarded so a replay without the job does not fail.

select cron.unschedule('queue-due-place-enrichments')
where exists (select 1 from cron.job where jobname = 'queue-due-place-enrichments');

drop function if exists public.queue_due_place_enrichments();

-- ══════════════════════════════════════════════════════════════════════════
-- 2. NAME HISTORY
-- ══════════════════════════════════════════════════════════════════════════
-- Trigger, then function, then table: CASCADE on the table would leave the
-- function behind.

drop trigger if exists place_name_history_capture_trg on public.place_profiles;
drop function if exists public.place_name_history_capture();
drop table if exists public.place_name_history;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. THE VIEW AND THE PLACES POLICY COME DOWN FIRST
-- ══════════════════════════════════════════════════════════════════════════
-- `profiles` projects eight of the columns below and both enum columns, and
-- DROP COLUMN / ALTER COLUMN TYPE refuse while a view reads them. The places
-- read policy names the dead labels 'lead' and 'queued', and ALTER COLUMN
-- TYPE refuses a column a policy uses. Both are restated in step 8.

drop view public.profiles;
drop policy if exists places_select_public_visible on public.places;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. COLUMNS
-- ══════════════════════════════════════════════════════════════════════════
-- Their indexes and CHECKs go with them: place_profiles_country_idx,
-- place_profiles_enrich_due_idx, place_profiles_enrich_every_days_range,
-- place_profiles_enrich_mode_kind, place_profiles_facebook_rating_check,
-- consumer_notifications_consumer_pending_idx, consumer_notifications_state_check,
-- super_admins_phone_key, place_tags_section_check.

alter table public.place_profiles
  drop column if exists vibe,
  drop column if exists email,
  drop column if exists country,
  drop column if exists details,
  drop column if exists editorial_summary,
  drop column if exists established_year,
  drop column if exists executive_chef,
  drop column if exists facebook_rating,
  drop column if exists enrich_every_days,
  drop column if exists enrich_mode,
  drop column if exists enrich_next_at;

alter table public.consumer_notifications
  drop column if exists state,
  drop column if exists resolved_at;

-- The pending index was also the only index leading with consumer_id, the
-- foreign key the inbox reads by and account deletion cascades through.
create index if not exists consumer_notifications_consumer_created_idx
  on public.consumer_notifications (consumer_id, created_at desc);

alter table public.consumers drop column if exists country;
alter table public.super_admins drop column if exists phone;
alter table public.place_tags drop column if exists section;
alter table public.reservation_tickets drop column if exists completed_at;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. FUNCTIONS THAT NAMED A DROPPED COLUMN
-- ══════════════════════════════════════════════════════════════════════════

-- admin_reset_database: the live body minus the super_admins.phone match.
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

  perform public.seed_place_families();
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
$function$;

-- seed_place_tags: the live body minus `section` (insert list and update set).
create or replace function public.seed_place_tags()
returns void
language sql
set search_path = ''
as $function$
  insert into public.place_tags (slug, label_es, label_en, facet, sort_order) values
    -- payment
    ('cash', 'Efectivo', 'Cash', 'payment', 1),
    ('cards', 'Tarjetas', 'Credit & debit cards', 'payment', 2),
    ('contactless', 'Pago sin contacto', 'Contactless / NFC', 'payment', 3),
    ('cash_only', 'Solo efectivo', 'Cash only', 'payment', 4),
    ('meal_vouchers', 'Vales de despensa', 'Meal vouchers', 'payment', 5),
    ('amex', 'Acepta AMEX', 'AMEX accepted', 'payment', 6),
    ('mobile_payments', 'Pagos móviles', 'Mobile payments', 'payment', 7),
    -- booking
    ('accepts_reservations', 'Acepta reservaciones', 'Accepts reservations', 'booking', 8),
    ('reservations_required', 'Reservación obligatoria', 'Reservations required', 'booking', 9),
    ('walk_ins_welcome', 'Sin reservación', 'Walk-ins welcome', 'booking', 10),
    ('online_booking', 'Reserva en línea', 'Online booking', 'booking', 11),
    ('usually_a_wait', 'Suele haber fila', 'Usually a wait', 'booking', 12),
    ('group_reservations', 'Grupos grandes', 'Large group bookings', 'booking', 13),
    ('private_events', 'Eventos privados', 'Private events', 'booking', 14),
    -- service
    ('dine_in', 'Para comer aquí', 'Dine-in', 'service', 15),
    ('takeout', 'Para llevar', 'Takeout', 'service', 16),
    ('delivery', 'A domicilio', 'Delivery', 'service', 17),
    ('drive_through', 'Drive-thru', 'Drive-through', 'service', 18),
    ('catering', 'Catering', 'Catering', 'service', 19),
    ('curbside_pickup', 'Recoger en auto', 'Curbside pickup', 'service', 20),
    ('counter_service', 'Ordena en barra', 'Counter service', 'service', 21),
    ('byob', 'Descorche', 'BYOB / corkage', 'service', 22),
    -- vibe
    ('casual', 'Casual', 'Casual', 'vibe', 23),
    ('upscale', 'Sofisticado', 'Upscale', 'vibe', 24),
    ('romantic', 'Romántico', 'Romantic', 'vibe', 25),
    ('cozy', 'Acogedor', 'Cozy', 'vibe', 26),
    ('trendy', 'De moda', 'Trendy', 'vibe', 27),
    ('lively', 'Animado', 'Lively', 'vibe', 28),
    ('quiet', 'Tranquilo', 'Quiet', 'vibe', 29),
    ('instagrammable', 'Instagrameable', 'Instagrammable', 'vibe', 30),
    ('classic', 'Clásico', 'Classic', 'vibe', 31),
    ('intimate', 'Íntimo', 'Intimate', 'vibe', 32),
    ('artsy', 'Artístico', 'Artsy', 'vibe', 33),
    ('historic', 'Histórico', 'Historic', 'vibe', 34),
    ('modern', 'Moderno', 'Modern', 'vibe', 35),
    ('rustic', 'Rústico', 'Rustic', 'vibe', 36),
    ('bohemian', 'Bohemio', 'Bohemian', 'vibe', 37),
    ('luxurious', 'Lujoso', 'Luxurious', 'vibe', 38),
    ('minimalist', 'Minimalista', 'Minimalist', 'vibe', 39),
    ('iconic', 'Icónico', 'Iconic', 'vibe', 40),
    ('themed', 'Temático', 'Themed', 'vibe', 41),
    ('festive', 'Festivo', 'Festive', 'vibe', 42),
    -- occasion
    ('date_night', 'Cita romántica', 'Date night', 'occasion', 43),
    ('groups', 'Grupos grandes', 'Good for groups', 'occasion', 44),
    ('families', 'Familias', 'Families', 'occasion', 45),
    ('business_meals', 'Comidas de negocios', 'Business meals', 'occasion', 46),
    ('special_occasions', 'Ocasiones especiales', 'Special occasions', 'occasion', 47),
    ('working_laptop', 'Trabajar con laptop', 'Good for working', 'occasion', 48),
    ('solo', 'Para ir solo', 'Solo friendly', 'occasion', 49),
    ('birthdays', 'Cumpleaños', 'Birthdays', 'occasion', 50),
    ('celebrations', 'Celebraciones', 'Celebrations', 'occasion', 51),
    ('girls_night', 'Noche de chicas', 'Girls'' night', 'occasion', 52),
    ('after_work', 'After office', 'After work', 'occasion', 53),
    ('first_dates', 'Primeras citas', 'First dates', 'occasion', 54),
    ('studying', 'Para estudiar', 'Good for studying', 'occasion', 55),
    ('watching_sports', 'Ver deportes', 'Watching sports', 'occasion', 56),
    ('late_night_out', 'Noche larga', 'Late night out', 'occasion', 57),
    -- amenities
    ('wifi', 'Wi-Fi', 'Wi-Fi', 'amenities', 58),
    ('air_conditioning', 'Aire acondicionado', 'Air conditioning', 'amenities', 59),
    ('outdoor_seating', 'Mesas al aire libre', 'Outdoor seating', 'amenities', 60),
    ('rooftop', 'Terraza / Rooftop', 'Rooftop', 'amenities', 61),
    ('private_room', 'Salón privado', 'Private room', 'amenities', 62),
    ('terrace', 'Terraza', 'Terrace', 'amenities', 63),
    ('garden', 'Jardín', 'Garden', 'amenities', 64),
    ('indoor_dining', 'Salón interior', 'Indoor dining room', 'amenities', 65),
    ('bar_seating', 'Barra', 'Bar seating', 'amenities', 66),
    ('booths', 'Gabinetes', 'Booths', 'amenities', 67),
    ('communal_tables', 'Mesas compartidas', 'Communal tables', 'amenities', 68),
    ('chefs_table', 'Mesa del chef', 'Chef''s table', 'amenities', 69),
    ('lounge', 'Lounge', 'Lounge area', 'amenities', 70),
    ('fireplace', 'Chimenea', 'Fireplace', 'amenities', 71),
    ('power_outlets', 'Enchufes', 'Power outlets', 'amenities', 72),
    ('parking', 'Estacionamiento', 'Parking', 'amenities', 73),
    ('valet', 'Valet parking', 'Valet parking', 'amenities', 74),
    ('free_parking', 'Estacionamiento gratis', 'Free parking', 'amenities', 75),
    ('paid_parking', 'Estacionamiento de paga', 'Paid parking', 'amenities', 76),
    ('street_parking', 'Estacionamiento en calle', 'Street parking', 'amenities', 77),
    ('parking_lot', 'Estacionamiento propio', 'Own parking lot', 'amenities', 78),
    ('bike_parking', 'Biciestacionamiento', 'Bike parking', 'amenities', 79),
    ('near_transit', 'Cerca del transporte', 'Near public transit', 'amenities', 80),
    ('ev_charging', 'Cargador eléctrico', 'EV charging', 'amenities', 81),
    ('walkable_area', 'Zona caminable', 'Walkable area', 'amenities', 82),
    ('central_location', 'Ubicación céntrica', 'Central location', 'amenities', 83),
    ('wheelchair_accessible', 'Accesible silla de ruedas', 'Wheelchair accessible', 'amenities', 84),
    ('wheelchair_entrance', 'Entrada accesible', 'Accessible entrance', 'amenities', 85),
    ('wheelchair_restroom', 'Baño accesible', 'Accessible restroom', 'amenities', 86),
    ('accessible_parking', 'Estacionamiento accesible', 'Accessible parking', 'amenities', 87),
    ('elevator', 'Elevador', 'Elevator', 'amenities', 88),
    ('high_chairs', 'Periqueras', 'High chairs', 'amenities', 89),
    ('changing_tables', 'Cambiadores', 'Changing tables', 'amenities', 90),
    ('stroller_friendly', 'Apto para carriolas', 'Stroller friendly', 'amenities', 91),
    ('restrooms', 'Baños', 'Public restrooms', 'amenities', 92),
    ('service_animals', 'Animales de servicio', 'Service animals welcome', 'amenities', 93),
    -- dietary
    ('vegetarian', 'Vegetariano', 'Vegetarian options', 'dietary', 94),
    ('vegan', 'Vegano', 'Vegan options', 'dietary', 95),
    ('gluten_free', 'Sin gluten', 'Gluten-free options', 'dietary', 96),
    ('healthy', 'Saludable', 'Healthy options', 'dietary', 97),
    ('organic', 'Orgánico', 'Organic', 'dietary', 98),
    ('keto', 'Keto', 'Keto-friendly', 'dietary', 99),
    ('dairy_free', 'Sin lácteos', 'Dairy-free options', 'dietary', 100),
    ('sugar_free', 'Sin azúcar', 'Sugar-free options', 'dietary', 101),
    ('halal', 'Halal', 'Halal', 'dietary', 102),
    ('kosher', 'Kosher', 'Kosher', 'dietary', 103),
    ('low_carb', 'Bajo en carbos', 'Low carb', 'dietary', 104),
    ('allergy_aware', 'Apto para alergias', 'Allergy aware', 'dietary', 105),
    -- menu
    ('breakfast', 'Desayuno', 'Breakfast', 'menu', 106),
    ('brunch', 'Brunch', 'Brunch', 'menu', 107),
    ('dinner', 'Cena', 'Dinner', 'menu', 108),
    ('coffee', 'Café', 'Coffee', 'menu', 109),
    ('dessert', 'Postres', 'Dessert', 'menu', 110),
    ('kids_menu', 'Menú infantil', 'Kids'' menu', 'menu', 111),
    ('street_food', 'Comida callejera', 'Street food', 'menu', 112),
    ('lunch', 'Comidas', 'Lunch', 'menu', 113),
    ('tea_selection', 'Té e infusiones', 'Tea selection', 'menu', 114),
    ('fresh_juices', 'Jugos naturales', 'Fresh juices', 'menu', 115),
    ('smoothies', 'Smoothies', 'Smoothies', 'menu', 116),
    ('tasting_menu', 'Menú degustación', 'Tasting menu', 'menu', 117),
    ('buffet', 'Buffet', 'Buffet', 'menu', 118),
    ('farm_to_table', 'De la granja a la mesa', 'Farm to table', 'menu', 119),
    ('wood_fired', 'Horno de leña', 'Wood-fired', 'menu', 120),
    -- drinks
    ('full_bar', 'Bar completo', 'Full bar', 'drinks', 121),
    ('cocktails', 'Coctelería', 'Cocktails', 'drinks', 122),
    ('craft_beer', 'Cerveza artesanal', 'Craft beer', 'drinks', 123),
    ('wine_list', 'Carta de vinos', 'Wine list', 'drinks', 124),
    ('mezcal_tequila', 'Mezcal y tequila', 'Mezcal & tequila', 'drinks', 125),
    ('happy_hour', 'Happy hour', 'Happy hour', 'drinks', 126),
    ('non_alcoholic', 'Sin alcohol', 'Non-alcoholic options', 'drinks', 127),
    ('beer', 'Cerveza', 'Serves beer', 'drinks', 128),
    ('craft_cocktails', 'Coctelería de autor', 'Craft cocktails', 'drinks', 129),
    ('natural_wine', 'Vino natural', 'Natural wine', 'drinks', 130),
    -- entertainment
    ('live_music', 'Música en vivo', 'Live music', 'entertainment', 131),
    ('dj', 'DJ', 'DJ', 'entertainment', 132),
    ('karaoke', 'Karaoke', 'Karaoke', 'entertainment', 133),
    ('dancing', 'Pista de baile', 'Dancing', 'entertainment', 134),
    ('sports_screening', 'Transmite deportes', 'Sports on TV', 'entertainment', 135),
    ('board_games', 'Juegos de mesa', 'Board games', 'entertainment', 136),
    ('trivia', 'Trivia', 'Trivia nights', 'entertainment', 137),
    ('comedy', 'Comedia', 'Comedy nights', 'entertainment', 138),
    ('live_shows', 'Shows en vivo', 'Live shows', 'entertainment', 139),
    ('mariachi', 'Mariachi y regional', 'Mariachi & regional', 'entertainment', 140),
    ('jazz', 'Jazz', 'Jazz nights', 'entertainment', 141),
    ('open_mic', 'Micrófono abierto', 'Open mic', 'entertainment', 142),
    ('billiards_tables', 'Billar', 'Billiards', 'entertainment', 143),
    ('arcade_games', 'Arcade', 'Arcade games', 'entertainment', 144),
    ('art_exhibitions', 'Expos de arte', 'Art exhibitions', 'entertainment', 145),
    ('themed_nights', 'Noches temáticas', 'Themed nights', 'entertainment', 146),
    ('wine_tastings', 'Catas', 'Tastings', 'entertainment', 147),
    -- crowd
    ('family_friendly', 'Para toda la familia', 'Family-friendly', 'crowd', 148),
    ('lgbtq_friendly', 'LGBTQ+ friendly', 'LGBTQ+ friendly', 'crowd', 149),
    ('pet_friendly', 'Pet friendly', 'Pet-friendly', 'crowd', 150),
    ('local_favorite', 'Favorito local', 'Local favorite', 'crowd', 151),
    ('tourist_favorite', 'Favorito de turistas', 'Tourist favorite', 'crowd', 152),
    ('adults_only', 'Solo adultos', 'Adults only', 'crowd', 153),
    ('senior_friendly', 'Adultos mayores bienvenidos', 'Senior friendly', 'crowd', 154),
    -- setting
    ('scenic_view', 'Con vista', 'Scenic view', 'setting', 155),
    ('beachfront', 'En la playa', 'Beachfront', 'setting', 156),
    ('downtown', 'En el centro', 'Downtown', 'setting', 157),
    ('mall_location', 'En plaza comercial', 'Inside a mall', 'setting', 158),
    ('hidden_gem', 'Joya escondida', 'Hidden gem', 'setting', 159),
    ('city_view', 'Vista a la ciudad', 'City view', 'setting', 160),
    ('sunset_spot', 'Atardeceres', 'Sunset spot', 'setting', 161),
    ('waterfront', 'Frente al agua', 'Waterfront', 'setting', 162),
    -- hours
    ('open_late', 'Abierto hasta tarde', 'Open late', 'hours', 163),
    ('open_24h', 'Abierto 24 horas', 'Open 24 hours', 'hours', 164),
    ('open_early', 'Abre temprano', 'Opens early', 'hours', 165),
    ('seasonal', 'De temporada', 'Seasonal', 'hours', 166),
    -- dress
    ('casual_dress', 'Vestimenta casual', 'Casual', 'dress', 167),
    ('smart_casual', 'Smart casual', 'Smart casual', 'dress', 168),
    ('formal_dress', 'Formal / Etiqueta', 'Formal', 'dress', 169),
    -- wellness
    ('unisex', 'Unisex', 'Unisex', 'wellness', 170),
    ('lockers', 'Lockers', 'Lockers', 'wellness', 171),
    ('showers', 'Regaderas', 'Showers', 'wellness', 172),
    ('sauna', 'Sauna', 'Sauna', 'wellness', 173),
    ('jacuzzi', 'Jacuzzi', 'Jacuzzi', 'wellness', 174),
    ('pool', 'Alberca', 'Pool', 'wellness', 175),
    ('private_cabins', 'Cabinas privadas', 'Private cabins', 'wellness', 176),
    ('couples_treatment', 'Tratamiento en pareja', 'Couples treatment', 'wellness', 177),
    ('day_pass', 'Pase del día', 'Day pass', 'wellness', 178),
    ('memberships', 'Membresías', 'Memberships', 'wellness', 179),
    -- experiences
    ('guided', 'Con guía', 'Guided', 'experiences', 180),
    ('equipment_provided', 'Equipo incluido', 'Equipment provided', 'experiences', 181),
    ('beginner_friendly', 'Para principiantes', 'Beginner-friendly', 'experiences', 182),
    ('all_ages', 'Para todas las edades', 'All ages', 'experiences', 183),
    ('kids_activity', 'Actividad infantil', 'Kids'' activity', 'experiences', 184),
    ('team_building', 'Team building', 'Team building', 'experiences', 185),
    ('transport_included', 'Transporte incluido', 'Transport included', 'experiences', 186),
    ('english_spoken', 'Inglés disponible', 'English spoken', 'experiences', 187),
    ('outdoor_activity', 'Al aire libre', 'Outdoor', 'experiences', 188),
    ('workshops', 'Talleres y clases', 'Workshops & classes', 'experiences', 189),
    ('indoor_activity', 'Actividad bajo techo', 'Indoor activity', 'experiences', 190),
    ('walking_trails', 'Para caminar y correr', 'Walking & running trails', 'experiences', 191),
    ('picnic_friendly', 'Para picnic', 'Picnic friendly', 'experiences', 192),
    ('gift_shop', 'Tienda de regalos', 'Gift shop', 'experiences', 193),
    ('cafe_on_site', 'Café en sitio', 'Café on site', 'experiences', 194),
    -- values
    ('eco_friendly', 'Eco-friendly', 'Eco-friendly', 'values', 195),
    ('woman_owned', 'Negocio de mujeres', 'Woman-owned', 'values', 196),
    ('family_owned', 'Negocio familiar', 'Family owned', 'values', 197),
    ('non_smoking', 'No fumar', 'Non-smoking', 'values', 198),
    ('smoking_area', 'Área de fumar', 'Smoking area', 'values', 199),
    ('photography_allowed', 'Fotos permitidas', 'Photography allowed', 'values', 200)
  on conflict (slug) do update set
    label_es   = excluded.label_es,
    label_en   = excluded.label_en,
    facet      = excluded.facet,
    sort_order = excluded.sort_order;
$function$;

-- ══════════════════════════════════════════════════════════════════════════
-- 6. ENUM LABELS
-- ══════════════════════════════════════════════════════════════════════════
-- Postgres cannot drop an enum label, so each type is swapped: rename the
-- old one, create the new one, retype the column, drop the old type. The
-- defaults name the old type, so they come off first and go back on after.
-- reservation_tickets_due_retry_idx has `state = 'pending'::reservation_state`
-- in its predicate; a rebuilt index would compare the new type with the old
-- one, so it is dropped and restated around the swap.

alter type public.place_state rename to place_state_old;
create type public.place_state as enum ('active', 'paused', 'archived');
alter table public.places alter column state drop default;
alter table public.places
  alter column state type public.place_state using state::text::public.place_state;
alter table public.places alter column state set default 'active';
drop type public.place_state_old;

alter type public.content_state rename to content_state_old;
create type public.content_state as enum ('generating', 'ready', 'failed');
alter table public.places alter column content_state drop default;
alter table public.places
  alter column content_state type public.content_state
  using content_state::text::public.content_state;
alter table public.places alter column content_state set default 'generating';
drop type public.content_state_old;

drop index if exists public.reservation_tickets_due_retry_idx;
alter type public.reservation_state rename to reservation_state_old;
create type public.reservation_state as enum
  ('pending', 'confirmed', 'declined', 'cancelled', 'unreachable', 'unresolved');
alter table public.reservation_tickets alter column state drop default;
alter table public.reservation_tickets
  alter column state type public.reservation_state
  using state::text::public.reservation_state;
alter table public.reservation_tickets alter column state set default 'pending';
drop type public.reservation_state_old;
create index reservation_tickets_due_retry_idx
  on public.reservation_tickets (next_attempt_at)
  where state = 'pending'::public.reservation_state
    and attempts_state = 'scheduled';

-- ══════════════════════════════════════════════════════════════════════════
-- 7. THE PLACES READ POLICY
-- ══════════════════════════════════════════════════════════════════════════
-- Same rule as before, minus the two labels that no longer exist.

create policy places_select_public_visible on public.places
  for select to anon, authenticated
  using (
    state = 'active'::public.place_state
    and content_state = any (array[
      'ready'::public.content_state,
      'generating'::public.content_state,
      'failed'::public.content_state
    ])
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 8. THE VIEW GOES BACK UP
-- ══════════════════════════════════════════════════════════════════════════
-- The live definition minus the eight dropped columns, still
-- security_invoker so it reads with the caller's rights. Grants and both
-- INSTEAD OF triggers are restated: a dropped view takes them with it.

create or replace function public.profiles_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    name_embedding, name_embedding_hash,
    family_keys
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
    new.name_embedding, new.name_embedding_hash,
    new.family_keys
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
$function$;

create or replace function public.profiles_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    mesita_name = new.mesita_name,
    family_keys = new.family_keys
  where id = old.id;
  update public.places set
    slug = new.slug, state = new.state, content_state = new.content_state,
    currency = new.currency
  where id = old.id;
  return new;
end
$function$;
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
    p.family_keys,
    p.reservations_enabled
   FROM places u
     JOIN place_profiles p ON p.id = u.id;

-- Exactly the grants the dropped view carried (live, 2026-10-11).
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

-- ══════════════════════════════════════════════════════════════════════════
-- 9. DEAD app_config KEYS
-- ══════════════════════════════════════════════════════════════════════════

-- MESITA-2144 stopped every reader and writer of these keys; the normalizers
-- already drop them on the next save. This strips the stored copies and
-- resets the column defaults, so a fresh row never brings them back.

-- reservations_config: the channel is phone, fixed in code; the tries are
-- the ATTEMPTS constant; the test call has one number.
update public.app_config
   set reservations_config =
         (reservations_config - 'disabled' - 'priority' - 'attempts')
         #- '{testCall,consumerNumber}'
 where id = 1;
alter table public.app_config
  alter column reservations_config set default '{"respectAdminOverride": true}'::jsonb;

-- models_config: Memo and the Enricher pick one model each; the Perplexity
-- picks and the supabase/ojo jobs have no reader.
update public.app_config
   set models_config =
         (models_config #- '{memo,perplexity}' #- '{enricher,perplexity}')
         - 'supabase' - 'ojo'
 where id = 1;
alter table public.app_config
  alter column models_config set default
    '{"v": 1, "memo": {"model": "gpt-4o-mini"}, "enricher": {"model": "gpt-4o-mini"}, "embeddings": {"model": "text-embedding-3-small"}}'::jsonb;

-- memo_config: Memo reads its greeting and instructions; the provider,
-- model, web-grounding and Perplexity keys were the old chat's. The CHECK
-- pinned all six, so it is restated for the two that are read.
alter table public.app_config drop constraint if exists app_config_memo_config_check;
update public.app_config
   set memo_config = memo_config - 'provider' - 'openaiModel' - 'webGrounding' - 'perplexityModel'
 where id = 1;
alter table public.app_config
  add constraint app_config_memo_config_check check (
    jsonb_typeof(memo_config) = 'object'
    and jsonb_typeof(memo_config -> 'greeting') = 'string'
    and jsonb_typeof(memo_config -> 'instructions') = 'string'
  );

-- discovery_config: the summary signal (never fed a query vector), the
-- social section, the slotting block and the swipe/name keys no engine
-- reads. weights.mesita_level stays (it still feeds `enriched`), and so does
-- swipe.savedAt. `swipe` itself is a persisted engine key and keeps its name.
update public.app_config
   set discovery_config =
         (discovery_config - 'social' - 'slotting')
         #- '{weights,summary}'
         #- '{params,summary}'
         #- '{params,mesita_level}'
         #- '{params,name,unembedded}'
         #- '{name,deep,count}'
         #- '{name,deep,partnerCount}'
         #- '{swipe,logDivisor}'
         #- '{swipe,partnerBias}'
         #- '{swipe,randomnessMax}'
         #- '{swipe,starsExponent}'
         #- '{swipe,categoryFilter}'
         #- '{swipe,weightProximity}'
 where id = 1;
-- The old default still seeded `semantic` weights and slotting. The code
-- supplies every default it needs, so the column keeps only the two blocks a
-- fresh row has always started with.
alter table public.app_config
  alter column discovery_config set default jsonb_build_object(
    'filters', jsonb_build_object('requireReady', true, 'minRating', 0, 'minReviews', 0, 'maxDistanceKm', 0),
    'engines', jsonb_build_object('swipe', jsonb_build_object('ranked', true))
  );

-- enrichment_config: the per-run cost cap nothing enforced. MESITA-2144
-- already took it out of the CHECK.
update public.app_config
   set enrichment_config = enrichment_config - 'atlasPerRunCostCapUsd'
 where id = 1;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. POST-FLIGHT
-- ══════════════════════════════════════════════════════════════════════════

do $postflight$
declare
  leftovers text[];
begin
  if to_regclass('public.place_name_history') is not null then
    raise exception 'place_name_history survived';
  end if;
  if to_regprocedure('public.queue_due_place_enrichments()') is not null
     or to_regprocedure('public.place_name_history_capture()') is not null then
    raise exception 'a dropped function survived';
  end if;
  if exists (select 1 from cron.job where jobname = 'queue-due-place-enrichments') then
    raise exception 'queue-due-place-enrichments is still scheduled';
  end if;

  select array_agg(table_name || '.' || column_name) into leftovers
    from information_schema.columns
   where table_schema = 'public'
     and (table_name, column_name) in (
       ('place_profiles', 'vibe'), ('place_profiles', 'email'),
       ('place_profiles', 'country'), ('place_profiles', 'details'),
       ('place_profiles', 'editorial_summary'), ('place_profiles', 'established_year'),
       ('place_profiles', 'executive_chef'), ('place_profiles', 'facebook_rating'),
       ('place_profiles', 'enrich_every_days'), ('place_profiles', 'enrich_mode'),
       ('place_profiles', 'enrich_next_at'),
       ('profiles', 'vibe'), ('profiles', 'email'), ('profiles', 'country'),
       ('profiles', 'details'), ('profiles', 'editorial_summary'),
       ('profiles', 'established_year'), ('profiles', 'executive_chef'),
       ('profiles', 'facebook_rating'),
       ('consumer_notifications', 'state'), ('consumer_notifications', 'resolved_at'),
       ('consumers', 'country'), ('super_admins', 'phone'),
       ('place_tags', 'section'), ('reservation_tickets', 'completed_at')
     );
  if leftovers is not null then
    raise exception 'columns survived: %', leftovers;
  end if;

  if (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
       where enumtypid = 'public.place_state'::regtype)
     is distinct from array['active', 'paused', 'archived'] then
    raise exception 'place_state labels are wrong';
  end if;
  if (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
       where enumtypid = 'public.content_state'::regtype)
     is distinct from array['generating', 'ready', 'failed'] then
    raise exception 'content_state labels are wrong';
  end if;
  if exists (select 1 from pg_enum
              where enumtypid = 'public.reservation_state'::regtype
                and enumlabel = 'no_show') then
    raise exception 'reservation_state still has no_show';
  end if;
  if exists (select 1 from pg_type where typname in
              ('place_state_old', 'content_state_old', 'reservation_state_old')) then
    raise exception 'an old enum type survived the swap';
  end if;

  if not exists (select 1 from pg_class
                  where oid = 'public.profiles'::regclass
                    and 'security_invoker=true' = any (reloptions)) then
    raise exception 'profiles lost security_invoker';
  end if;
  if (select count(*) from pg_trigger
       where tgrelid = 'public.profiles'::regclass and not tgisinternal) <> 2 then
    raise exception 'profiles does not carry exactly its two INSTEAD OF triggers';
  end if;
  if not exists (select 1 from pg_policy
                  where polrelid = 'public.places'::regclass
                    and polname = 'places_select_public_visible') then
    raise exception 'places_select_public_visible is missing';
  end if;
  if to_regclass('public.reservation_tickets_due_retry_idx') is null then
    raise exception 'reservation_tickets_due_retry_idx is missing';
  end if;

  if exists (
    select 1 from public.app_config
     where reservations_config ?| array['disabled', 'priority', 'attempts']
        or reservations_config #> '{testCall,consumerNumber}' is not null
        or models_config ?| array['supabase', 'ojo']
        or models_config #> '{memo,perplexity}' is not null
        or models_config #> '{enricher,perplexity}' is not null
        or memo_config ?| array['provider', 'openaiModel', 'webGrounding', 'perplexityModel']
        or discovery_config ?| array['social', 'slotting']
        or discovery_config #> '{weights,summary}' is not null
        or discovery_config #> '{params,summary}' is not null
        or enrichment_config ? 'atlasPerRunCostCapUsd'
  ) then
    raise exception 'a dead app_config key survived';
  end if;
end $postflight$;
