// Shared Enricher place field limits — enforced by the Enricher, the create
// door and admin-web-update-place, and shipped to the admin Profile editor on
// the one profile read, admin-web-get-overview (placeName, description,
// tagsPerPlace and photos). admin-web-get-atlas-fields still returns them;
// the profile page does not call it.

export const ENRICH_FIELD_LIMITS = {
  placeName: { max: 80 },
  // The Presentation ceiling, one number everywhere: the Enricher's synthesis
  // slice (ENRICH_DESCRIPTION_MAX reads this), Render's Google fallback, and
  // the Place editor (admin-web-update-place). 2000 characters (MESITA-2739).
  description: { max: 2000 },
  // The Semantic Summary that OpenAI embeds (places.embedding_source_text) —
  // NOT the Presentation. One of the three enrichment texts, and the only one
  // the INDEX reads (`_shared/crenup-ladder.ts`). Words, enforced at word
  // boundaries in place-embeddings.ts (never a mid-word char slice).
  embeddingSourceText: { max: 60 },
  // The Enricher always writes exactly 20 tags; the editor allows up to 20.
  tagsPerPlace: { max: 20 },
  // Mesita Families per place: the Description step picks 1–5 (MESITA-2891)
  // and the Basics editor allows up to 5 (MESITA-2893). The taxonomy trigger
  // refuses a sixth, so this number and the trigger's literal are one.
  familiesPerPlace: { max: 5 },
  tagSlugLength: { max: 40 },
  // Mirrors app_config.enrichment_config.enrichSaveTotalImages (1–10; DB CHECK 0–10). Set
  // through the `enricher` config section, which is the only writer left now
  // that the admin Enrichment page renders no knobs. Lowering this number is
  // what lowers the server validator too — _shared/config-section-enricher.ts
  // derives SAVE_TOTAL_IMAGES_MAX from it rather than restating it. The S9
  // storage-mirror step (store-place-images.ts / PHOTO_CEILING) separately
  // hard-caps the persisted array at 50 regardless of this setting — the two
  // are not the same knob.
  photos: { max: 10 },
  // Hard Apify scrape ceiling (EF wall-clock + cost). Live gather count is
  // app_config.enrichment_config.enrichGatherReviews (0–100); this is the profile-spec max the
  // pipeline may never exceed.
  googleReviews: { max: 100 },
} as const;
