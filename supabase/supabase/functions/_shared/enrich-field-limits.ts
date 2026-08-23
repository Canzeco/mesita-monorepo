// Shared Enricher place field limits — mirrored in business-web-update-project and
// the business Place editor. Surfaced read-only in admin-web-get-atlas-fields.
//
// `unit` drives the admin card's format: "chars" → "N chars", "words" → "N
// words", "count" → "Up to N", "range" → "min–max". `min` is only set for range
// fields (today just price_level); every other field's floor is implicitly
// 0/none.

export const ENRICH_FIELD_LIMITS = {
  placeName: { max: 80, unit: "chars", note: "Business Place editor" },
  // The business editor's own overwrite ceiling — see descriptionEnricherMax
  // for what a fresh Enricher synthesis may write before any manual edit.
  description: {
    max: 2000,
    unit: "chars",
    note: "Presentation overwrite via the business Place editor (business-web-update-project). A freshly-enriched place can exceed this — see \"Description (Enricher synthesis)\".",
  },
  // The Enricher's own synthesis ceiling (enrich-synthesis-profile.ts) —
  // ENRICH_DESCRIPTION_MAX = 1,000-word target × 7. Not the same limit as the
  // business editor's 2,000-char overwrite cap above; a place enriched today
  // and never hand-edited can carry up to this many characters.
  descriptionEnricherMax: {
    max: 7000,
    unit: "chars",
    note: "places.description as freshly written by an Enricher run, before any business-editor overwrite (7,000 = 1,000-word target × 7).",
  },
  // The Semantic Summary that OpenAI embeds (places.embedding_source_text) —
  // NOT the Presentation. One of the three enrichment texts, and the only one
  // the INDEX reads (`_shared/pulse-pieces.ts`). Enforced at word boundaries in
  // place-embeddings.ts (never a mid-word char slice).
  embeddingSourceText: {
    max: 60,
    unit: "words",
    note: "places.embedding_source_text — the Semantic Summary the index reads (On-Create / On-Update / lazy backfill). Hard 60-word ceiling, truncated on word boundaries.",
  },
  tagsPerPlace: {
    max: 20,
    unit: "count",
    note: "Enricher always writes exactly 20 tags; business editor allows up to 20 (places.tags)",
  },
  tagCatalogSize: { max: 200, unit: "count", note: "Controlled tags in place_tags (Atlas taxonomy)" },
  tagSlugLength: { max: 40, unit: "chars", note: "Per-tag slug length cap" },
  // Mirrors the Enricher Config "Images → Save Total Images" knob
  // (admin-tunable 1–10; DB CHECK atlas_save_total_images 0–10). Lowering this
  // number is what lowers the server validator too — admin-web-update-enricher-
  // config derives SAVE_TOTAL_IMAGES_MAX from it rather than restating it. The S9
  // storage-mirror step (store-place-images.ts / PHOTO_CEILING) separately
  // hard-caps the persisted array at 50 regardless of this setting — the two
  // are not the same knob.
  photos: {
    max: 10,
    unit: "count",
    note: "places.photos array (hero + gallery) — mirrors the Enricher Config \"Save Total Images\" setting (admin-tunable 1–10, DB max 10, enforced by app_config_atlas_save_total_images_range); a separate storage-mirror step (PHOTO_CEILING=50) caps the array at 50 regardless.",
  },
  // Hard Apify scrape ceiling (EF wall-clock + cost). Live gather count is
  // app_config.atlas_gather_reviews (0–100) on Enricher Config; this is the
  // profile-spec max the pipeline may never exceed.
  googleReviews: {
    max: 100,
    unit: "count",
    note: "places.google_reviews — Apify scrape cap (Places API ~5; Mesita EF/cost safety bound)",
  },
  phone: {
    max: 40,
    unit: "chars",
    note: "Business Place editor / business-web-update-project — must start with a country code (E.164-shaped, e.g. +52…).",
  },
  email: {
    max: 254,
    unit: "chars",
    note: "Business Place editor / business-web-update-project — standard email-shape check.",
  },
  // DB CHECK, not just an EF-layer validation — the strongest enforcement of
  // any field on this page. Google native: the Enricher writes it from Google
  // Places' own 1–4 price level; business-web-update-project rejects manual
  // writes outright.
  priceLevel: {
    min: 1,
    max: 4,
    unit: "range",
    note: "places_price_level_check (DB CHECK) — Google Places only; the EF rejects manual writes.",
  },
} as const;
