# MESITA-943 — database cleanup round 4 (50 iterations)

Follow-up to MESITA-940 / #727, MESITA-941 / #728, MESITA-942 / #729+#730. Each item is one focused improvement.

1. Narrow `classes_select_all` RLS to `anon, authenticated` (off PUBLIC)
2. Narrow `place_categories_select_all` to `anon, authenticated`
3. Narrow `place_tags_select_all` to `anon, authenticated`
4. Narrow `consumers_select_self` to `authenticated` only
5. COMMENT ON VIEW `projects_view` (SECURITY INVOKER + SELECT-only)
6. COMMENT ON FUNCTION `seed_place_categories` (EF-only seed posture)
7. COMMENT ON FUNCTION `seed_place_tags`
8. COMMENT ON FUNCTION `sync_place_category_label`
9. COMMENT ON FUNCTION `generate_consumer_code`
10. COMMENT ON FUNCTION `bump_reservation_call_counter`
11. `readJson` → `jsonError("Invalid JSON")`
12. `consumer-lookup` uses shared `phoneDigits`
13. `agent-tools.phoneTail` uses shared `phoneDigits`
14. `agent-tools.ticketByCode` uses shared `phoneDigits`
15. `eleven-agent-get-reservation` uses shared `phoneDigits`
16. `venueLocalDate` → `placeLocalDate` (+ deprecated alias)
17. `venueLocalTime` → `placeLocalTime` (+ deprecated alias)
18. `eleven-a2-confirm-reservation` adopts `placeLocal*`
19. Drop staff-web linklab `venues` body alias
20. staff-web linklab adopts `jsonError`
21. `tags.ts` DEFAULT from `DEFAULT_MODELS_CONFIG.enricher.model`
22. `categories-infer.ts` DEFAULT from `DEFAULT_MODELS_CONFIG`
23. `place-embeddings.ts` DEFAULT from `DEFAULT_MODELS_CONFIG`
24. `recommender-rank-map.ts` DEFAULT from `DEFAULT_MODELS_CONFIG`
25. `perplexity-chat.ts` DEFAULT from `DEFAULT_MODELS_CONFIG.memo.perplexity`
26. `memo-airlock-tools.ts` DEFAULT from `DEFAULT_MODELS_CONFIG`
27. `memo-answer.ts` DEFAULT from `DEFAULT_MODELS_CONFIG`
28. `business-web-suggest-promo` DEFAULT from `DEFAULT_MODELS_CONFIG`
29. `admin-web-ask-memo` DEFAULT from `DEFAULT_MODELS_CONFIG`
30. `admin-web-get-models-config` → `jsonOk`/`jsonError`
31. `admin-web-get-lineup-config` → `jsonOk`/`jsonError`
32. `admin-web-get-memo-config` → `jsonOk`/`jsonError`
33. `admin-web-get-scoring-config` → `jsonOk`/`jsonError`
34. `admin-web-get-rewards-config` → `jsonOk`/`jsonError`
35. `admin-web-get-reservations-config` → `jsonOk`/`jsonError`
36. `admin-web-get-sourcing-config` → `jsonOk`/`jsonError`
37. `admin-web-get-verification-config` → `jsonOk`/`jsonError`
38. `admin-web-get-settings` → `jsonOk`/`jsonError`
39. `admin-web-get-place-verification` → `jsonOk`/`jsonError`
40. `admin-web-update-*` batch adopts `jsonError` (incl. atlas-config)
41. `parseVenueLocal` → `parsePlaceLocal` (+ deprecated alias)
42. `enrich-config.VISION_MODEL` from `DEFAULT_MODELS_CONFIG`
43. `embeddings-http.DEFAULT_EMBEDDING_MODEL` from `DEFAULT_MODELS_CONFIG.lineup`
44. `QUALITY_MODEL.economy` uses `VISION_MODEL` (no drift)
45. `consumer-web-ask-memo` model fallbacks from `DEFAULT_MODELS_CONFIG`
46. sync-reservationist comment: venue-facing → place-facing
47. `_shared/models-config.test.ts`
48. `_shared/phone.test.ts`
49. ARCHITECTURE.md + CLAUDE.md grant/policy posture (MESITA-943); sync AGENTS.md
50. CLEANUP ledger + CI-equivalent `deno lint` / focused unit tests green
