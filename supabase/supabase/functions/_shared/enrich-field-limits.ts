// Shared Enricher place field limits — enforced by the Enricher, the create
// door and admin-web-update-place, and shipped to the admin Profile editor by
// admin-web-get-atlas-fields (which reads placeName, description, tagsPerPlace
// and photos).

export const ENRICH_FIELD_LIMITS = {
  placeName: { max: 80 },
  // The Place editor's overwrite ceiling (admin-web-update-place). A freshly
  // enriched place can exceed it: the Enricher's own synthesis ceiling is
  // ENRICH_DESCRIPTION_MAX (1,000-word target × 7, enrich-config.ts).
  description: { max: 2000 },
  // The Semantic Summary that OpenAI embeds (places.embedding_source_text) —
  // NOT the Presentation. One of the three enrichment texts, and the only one
  // the INDEX reads (`_shared/crenup-ladder.ts`). Words, enforced at word
  // boundaries in place-embeddings.ts (never a mid-word char slice).
  embeddingSourceText: { max: 60 },
  // The Enricher always writes exactly 20 tags; the editor allows up to 20.
  tagsPerPlace: { max: 20 },
  tagSlugLength: { max: 40 },
  // Mirrors app_config.enrichment_config.atlasSaveTotalImages (1–10; DB CHECK 0–10). Set
  // through the `enricher` config section, which is the only writer left now
  // that the admin Enrichment page renders no knobs. Lowering this number is
  // what lowers the server validator too — _shared/config-section-enricher.ts
  // derives SAVE_TOTAL_IMAGES_MAX from it rather than restating it. The S9
  // storage-mirror step (store-place-images.ts / PHOTO_CEILING) separately
  // hard-caps the persisted array at 50 regardless of this setting — the two
  // are not the same knob.
  photos: { max: 10 },
  // Hard Apify scrape ceiling (EF wall-clock + cost). Live gather count is
  // app_config.enrichment_config.atlasGatherReviews (0–100); this is the profile-spec max the
  // pipeline may never exceed.
  googleReviews: { max: 100 },
} as const;
