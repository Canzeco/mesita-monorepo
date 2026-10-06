// THE ATLAS VOCABULARY — families, categories, tag facets, tags, field limits.
//
// In the real console every one of these arrives from one Edge Function call,
// `business-web-get-atlas-fields`, which is the same catalog Atlas Config
// edits: the list is CONFIG THAT LIVES IN THE DB, read live, never hardcoded.
// Here it is a constant, because this app has no network and the whole point
// of it is that there is nothing behind the screen.
//
// IT IS A SLICE, NOT A MIRROR. The real seed is ~100 categories and ~200 tags
// across 17 facets. A grouped select reads the same at forty rows as at a
// hundred, and a fixture that matched the table row for row would quietly
// acquire a job — being re-synced every time somebody adds a category — which
// is exactly the kind of obligation a mock exists to not have. The slugs,
// labels, emoji and section names below are the real ones; the omissions are
// the whole difference.
//
// Separate from `fixtures.ts` on purpose: that file is the four PLACES and
// everything that hangs off them, and thirty rows of taxonomy in the middle of
// it would read as more invented venue data rather than as Mesita's own
// vocabulary.
import type {
  MockCategoryOption,
  MockFamilyOption,
  MockFieldLimits,
  MockTagFacet,
  MockTagOption,
} from "@/mock/types";

/** All eight, complete — the families are the short list, so there is nothing
 *  to slice. `undefined` is a real row: a place with no category still has to
 *  print something, and "❓ Undefined" is that something. */
export const FAMILIES: MockFamilyOption[] = [
  { slug: "restaurants", label: "Restaurants", emoji: "🍽️", sort_order: 1 },
  { slug: "cafes_bakeries", label: "Cafés & Desserts", emoji: "☕", sort_order: 2 },
  { slug: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸", sort_order: 3 },
  { slug: "experiences", label: "Experiences", emoji: "🎟️", sort_order: 4 },
  { slug: "culture_arts", label: "Culture & Arts", emoji: "🎭", sort_order: 5 },
  { slug: "sports_fitness", label: "Sports & Fitness", emoji: "⚽", sort_order: 6 },
  { slug: "wellness_beauty", label: "Wellness & Beauty", emoji: "💆", sort_order: 7 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 999 },
];

/** Two sections, as the real select groups them: "Food & Nightlife" and
 *  "Experiences & Wellness". Every row carries its family membership, because
 *  the Family field derives LIVE from the category the select currently holds
 *  — unsaved edits included. */
export const CATEGORIES: MockCategoryOption[] = [
  { slug: "mexican", label: "🌮 Mexican", section: "Food & Nightlife", sort_order: 1, family_keys: ["restaurants"] },
  { slug: "taco", label: "🌮 Tacos", section: "Food & Nightlife", sort_order: 2, family_keys: ["restaurants"] },
  { slug: "seafood", label: "🦐 Seafood", section: "Food & Nightlife", sort_order: 3, family_keys: ["restaurants"] },
  { slug: "steak_house", label: "🥩 Steakhouse", section: "Food & Nightlife", sort_order: 4, family_keys: ["restaurants"] },
  { slug: "italian", label: "🍝 Italian", section: "Food & Nightlife", sort_order: 5, family_keys: ["restaurants"] },
  { slug: "pizza", label: "🍕 Pizza", section: "Food & Nightlife", sort_order: 6, family_keys: ["restaurants"] },
  { slug: "japanese", label: "🍱 Japanese", section: "Food & Nightlife", sort_order: 7, family_keys: ["restaurants"] },
  { slug: "sushi", label: "🍣 Sushi", section: "Food & Nightlife", sort_order: 8, family_keys: ["restaurants"] },
  { slug: "mediterranean", label: "🫒 Mediterranean", section: "Food & Nightlife", sort_order: 16, family_keys: ["restaurants"] },
  { slug: "spanish", label: "🥘 Spanish", section: "Food & Nightlife", sort_order: 18, family_keys: ["restaurants"] },
  { slug: "french", label: "🥐 French", section: "Food & Nightlife", sort_order: 19, family_keys: ["restaurants"] },
  { slug: "american", label: "🍟 American", section: "Food & Nightlife", sort_order: 20, family_keys: ["restaurants"] },
  { slug: "argentinian", label: "🥩 Argentinian", section: "Food & Nightlife", sort_order: 21, family_keys: ["restaurants"] },
  { slug: "burger", label: "🍔 Burgers", section: "Food & Nightlife", sort_order: 25, family_keys: ["restaurants"] },
  { slug: "bbq", label: "🍖 BBQ", section: "Food & Nightlife", sort_order: 27, family_keys: ["restaurants"] },
  { slug: "breakfast", label: "🍳 Breakfast", section: "Food & Nightlife", sort_order: 28, family_keys: ["restaurants"] },
  { slug: "brunch", label: "🥞 Brunch", section: "Food & Nightlife", sort_order: 29, family_keys: ["restaurants"] },
  { slug: "vegan", label: "🌱 Vegan", section: "Food & Nightlife", sort_order: 30, family_keys: ["restaurants"] },
  { slug: "fine_dining", label: "🍽️ Fine Dining", section: "Food & Nightlife", sort_order: 35, family_keys: ["restaurants"] },
  { slug: "cafe", label: "☕ Café", section: "Food & Nightlife", sort_order: 39, family_keys: ["cafes_bakeries"] },
  { slug: "coffee_shop", label: "☕ Coffee Shop", section: "Food & Nightlife", sort_order: 40, family_keys: ["cafes_bakeries"] },
  { slug: "bakery", label: "🥐 Bakery", section: "Food & Nightlife", sort_order: 41, family_keys: ["cafes_bakeries"] },
  { slug: "dessert_shop", label: "🍰 Desserts", section: "Food & Nightlife", sort_order: 42, family_keys: ["cafes_bakeries"] },
  { slug: "ice_cream", label: "🍦 Ice Cream", section: "Food & Nightlife", sort_order: 43, family_keys: ["cafes_bakeries"] },
  { slug: "bar", label: "🍺 Bar", section: "Food & Nightlife", sort_order: 45, family_keys: ["bars_nightlife"] },
  { slug: "pub", label: "🍺 Pub", section: "Food & Nightlife", sort_order: 46, family_keys: ["bars_nightlife"] },
  { slug: "cocktail_bar", label: "🍸 Cocktail Bar", section: "Food & Nightlife", sort_order: 47, family_keys: ["bars_nightlife"] },
  { slug: "wine_bar", label: "🍷 Wine Bar", section: "Food & Nightlife", sort_order: 48, family_keys: ["bars_nightlife"] },
  { slug: "brewery", label: "🍻 Brewery", section: "Food & Nightlife", sort_order: 49, family_keys: ["bars_nightlife"] },
  { slug: "night_club", label: "🪩 Nightclub", section: "Food & Nightlife", sort_order: 50, family_keys: ["bars_nightlife"] },
  { slug: "bowling_alley", label: "🎳 Bowling", section: "Experiences & Wellness", sort_order: 51, family_keys: ["experiences"] },
  { slug: "arcade", label: "🕹️ Arcade", section: "Experiences & Wellness", sort_order: 54, family_keys: ["experiences"] },
  { slug: "park", label: "🌳 Park", section: "Experiences & Wellness", sort_order: 57, family_keys: ["experiences"] },
  { slug: "movie_theater", label: "🎬 Movie Theater", section: "Experiences & Wellness", sort_order: 63, family_keys: ["experiences", "culture_arts"] },
  { slug: "gym", label: "💪 Gym", section: "Experiences & Wellness", sort_order: 67, family_keys: ["sports_fitness"] },
  { slug: "yoga_studio", label: "🧘 Yoga Studio", section: "Experiences & Wellness", sort_order: 68, family_keys: ["sports_fitness", "wellness_beauty"] },
  { slug: "padel_club", label: "🎾 Padel Club", section: "Experiences & Wellness", sort_order: 72, family_keys: ["sports_fitness"] },
  { slug: "spa", label: "💆 Spa", section: "Experiences & Wellness", sort_order: 79, family_keys: ["wellness_beauty"] },
  { slug: "barbershop", label: "💈 Barbershop", section: "Experiences & Wellness", sort_order: 84, family_keys: ["wellness_beauty"] },
  { slug: "museum", label: "🏛️ Museum", section: "Experiences & Wellness", sort_order: 91, family_keys: ["culture_arts"] },
  { slug: "art_gallery", label: "🖼️ Art Gallery", section: "Experiences & Wellness", sort_order: 92, family_keys: ["culture_arts"] },
  { slug: "theater", label: "🎭 Theater", section: "Experiences & Wellness", sort_order: 97, family_keys: ["culture_arts"] },
  { slug: "market", label: "🛒 Market", section: "Experiences & Wellness", sort_order: 101, family_keys: ["experiences"] },
  { slug: "undefined", label: "❓ Undefined", section: "Food & Nightlife", sort_order: 999 },
];

/** Eight of the seventeen facets — enough that the picker scrolls through
 *  several sticky group headers, which is the thing about it worth looking at.
 *  The emoji and bilingual labels are the real ones (`_shared/tags.ts`). */
export const TAG_FACETS: MockTagFacet[] = [
  { slug: "payment", emoji: "💳", label_es: "Pago", label_en: "Payment" },
  { slug: "booking", emoji: "📅", label_es: "Reservas", label_en: "Booking" },
  { slug: "service", emoji: "🍽️", label_es: "Servicio", label_en: "Service" },
  { slug: "vibe", emoji: "✨", label_es: "Ambiente", label_en: "Vibe" },
  { slug: "occasion", emoji: "🎉", label_es: "Ideal para", label_en: "Good for" },
  { slug: "amenities", emoji: "🛋️", label_es: "Servicios", label_en: "Amenities" },
  { slug: "dietary", emoji: "🥗", label_es: "Dietético", label_en: "Dietary" },
  { slug: "drinks", emoji: "🍸", label_es: "Bar y bebidas", label_en: "Drinks" },
];

const tag = (
  slug: string,
  label_es: string,
  label_en: string,
  facet: string,
  section: string,
  sort_order: number,
): MockTagOption => ({ slug, label_es, label_en, facet, section, sort_order });

/** `label_es` is carried even though nothing here renders it: the picker
 *  SEARCHES both languages, and dropping the Spanish column would make the
 *  search box quietly narrower than the real one. */
export const TAGS: MockTagOption[] = [
  tag("cash", "Efectivo", "Cash", "payment", "Both", 1),
  tag("cards", "Tarjetas", "Credit & debit cards", "payment", "Both", 2),
  tag("contactless", "Pago sin contacto", "Contactless / NFC", "payment", "Both", 3),
  tag("cash_only", "Solo efectivo", "Cash only", "payment", "Both", 4),
  tag("amex", "Acepta AMEX", "AMEX accepted", "payment", "Both", 6),
  tag("mobile_payments", "Pagos móviles", "Mobile payments", "payment", "Both", 7),

  tag("accepts_reservations", "Acepta reservaciones", "Accepts reservations", "booking", "Both", 8),
  tag("reservations_required", "Reservación obligatoria", "Reservations required", "booking", "Both", 9),
  tag("walk_ins_welcome", "Sin reservación", "Walk-ins welcome", "booking", "Both", 10),
  tag("online_booking", "Reserva en línea", "Online booking", "booking", "Both", 11),
  tag("usually_a_wait", "Suele haber fila", "Usually a wait", "booking", "Both", 12),
  tag("private_events", "Eventos privados", "Private events", "booking", "Both", 14),

  tag("dine_in", "Para comer aquí", "Dine-in", "service", "Food & Nightlife", 15),
  tag("takeout", "Para llevar", "Takeout", "service", "Food & Nightlife", 16),
  tag("delivery", "A domicilio", "Delivery", "service", "Food & Nightlife", 17),
  tag("catering", "Catering", "Catering", "service", "Food & Nightlife", 19),
  tag("curbside_pickup", "Recoger en auto", "Curbside pickup", "service", "Food & Nightlife", 20),
  tag("counter_service", "Ordena en barra", "Counter service", "service", "Food & Nightlife", 21),

  tag("casual", "Casual", "Casual", "vibe", "Both", 23),
  tag("upscale", "Sofisticado", "Upscale", "vibe", "Both", 24),
  tag("romantic", "Romántico", "Romantic", "vibe", "Both", 25),
  tag("cozy", "Acogedor", "Cozy", "vibe", "Both", 26),
  tag("trendy", "De moda", "Trendy", "vibe", "Both", 27),
  tag("lively", "Animado", "Lively", "vibe", "Both", 28),
  tag("quiet", "Tranquilo", "Quiet", "vibe", "Both", 29),
  tag("instagrammable", "Instagrameable", "Instagrammable", "vibe", "Both", 30),
  tag("rustic", "Rústico", "Rustic", "vibe", "Both", 36),
  tag("minimalist", "Minimalista", "Minimalist", "vibe", "Both", 39),

  tag("date_night", "Cita romántica", "Date night", "occasion", "Both", 43),
  tag("groups", "Grupos grandes", "Good for groups", "occasion", "Both", 44),
  tag("families", "Familias", "Families", "occasion", "Both", 45),
  tag("business_meals", "Comidas de negocios", "Business meals", "occasion", "Both", 46),
  tag("special_occasions", "Ocasiones especiales", "Special occasions", "occasion", "Both", 47),
  tag("working_laptop", "Trabajar con laptop", "Good for working", "occasion", "Both", 48),
  tag("solo", "Para ir solo", "Solo friendly", "occasion", "Both", 49),
  tag("after_work", "After office", "After work", "occasion", "Both", 53),

  tag("wifi", "Wi-Fi", "Wi-Fi", "amenities", "Both", 58),
  tag("air_conditioning", "Aire acondicionado", "Air conditioning", "amenities", "Both", 59),
  tag("outdoor_seating", "Mesas al aire libre", "Outdoor seating", "amenities", "Both", 60),
  tag("rooftop", "Terraza / Rooftop", "Rooftop", "amenities", "Both", 61),
  tag("private_room", "Salón privado", "Private room", "amenities", "Both", 62),
  tag("terrace", "Terraza", "Terrace", "amenities", "Both", 63),
  tag("bar_seating", "Barra", "Bar seating", "amenities", "Both", 66),
  tag("power_outlets", "Enchufes", "Power outlets", "amenities", "Both", 72),
  tag("parking", "Estacionamiento", "Parking", "amenities", "Both", 73),
  tag("valet", "Valet parking", "Valet parking", "amenities", "Both", 74),
  tag("wheelchair_accessible", "Accesible silla de ruedas", "Wheelchair accessible", "amenities", "Both", 84),
  tag("high_chairs", "Periqueras", "High chairs", "amenities", "Both", 89),

  tag("vegetarian", "Vegetariano", "Vegetarian options", "dietary", "Food & Nightlife", 94),
  tag("vegan", "Vegano", "Vegan options", "dietary", "Food & Nightlife", 95),
  tag("gluten_free", "Sin gluten", "Gluten-free options", "dietary", "Food & Nightlife", 96),
  tag("healthy", "Saludable", "Healthy options", "dietary", "Food & Nightlife", 97),
  tag("organic", "Orgánico", "Organic", "dietary", "Food & Nightlife", 98),
  tag("allergy_aware", "Apto para alergias", "Allergy aware", "dietary", "Food & Nightlife", 105),

  tag("full_bar", "Bar completo", "Full bar", "drinks", "Food & Nightlife", 121),
  tag("cocktails", "Coctelería", "Cocktails", "drinks", "Food & Nightlife", 122),
  tag("craft_beer", "Cerveza artesanal", "Craft beer", "drinks", "Food & Nightlife", 123),
  tag("wine_list", "Carta de vinos", "Wine list", "drinks", "Food & Nightlife", 124),
  tag("mezcal_tequila", "Mezcal y tequila", "Mezcal & tequila", "drinks", "Food & Nightlife", 125),
  tag("happy_hour", "Happy hour", "Happy hour", "drinks", "Food & Nightlife", 126),
  tag("non_alcoholic", "Sin alcohol", "Non-alcoholic options", "drinks", "Food & Nightlife", 127),
  tag("natural_wine", "Vino natural", "Natural wine", "drinks", "Food & Nightlife", 130),
];

/** The real defaults, and the reason the Photos card can say "over the
 *  ceiling": ten is a CEILING that dropped (MESITA-1237), so a place enriched
 *  under the old one still legitimately holds more. */
export const FIELD_LIMITS: MockFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 2000,
  tagsPerPlaceMax: 20,
  photosMax: 10,
};
