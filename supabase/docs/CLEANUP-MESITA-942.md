# MESITA-942 — database cleanup round 3 (50 iterations)

Follow-up to MESITA-940 / #727 and MESITA-941 / #728. Each item is one focused improvement.

1. Revoke ALL privileges on EF-only tables from `anon`/`authenticated` (defense in depth)
2. Re-affirm `service_role` ALL on those EF-only tables
3. SELECT-only grants on browse/vocabulary tables (`places`, `projects`, `classes`, `place_categories`, `place_tags`, `consumers`)
4. COMMENT grant posture on EF-only tables (accounts/tickets/reservations/…)
5. COMMENT grant posture on browse tables (places/projects/classes/…)
6. Document intentional unused FK-covering indexes (advisor 0005 keep)
7. Document intentional unused queue partial indexes (story/review/verifications)
8. Document intentional unused geo/embedding/invite indexes
9. Revoke client USAGE/SELECT on all `public` sequences
10. Narrow `place_research_stage_status_idx` to pending|running claim queue
11. COMMENT already-locked tables (`place_research`, `place_creation_attempts`, `consumer_mcp_tokens`, `admin_reset_preserve`)
12. `ALTER DEFAULT PRIVILEGES` — stop future tables/sequences auto-granting to clients
13. Revoke leftover `PUBLIC` role table privileges on EF-only + DML on browse
14. `jsonOk` / `jsonError` helpers in `_shared/http.ts`
15. `handleGetIdentity` → `rejectUnlessMethods` + `jsonOk`
16. `admin-web-get-identity` door adopts `rejectUnlessMethods`
17. `business-web-get-identity` door adopts `rejectUnlessMethods`
18. Package `deno.json` lint task + exclude rules matching CI
19. `ReservationLegVars.venueName` → `placeName` (keep ElevenLabs `venue_name` wire key)
20. `venueCancelNotice*` → `placeCancelNotice*`
21. `GuestLegContext.venueAlternatives` → `placeAlternatives` (keep wire key)
22. Reservation-call `venueLineId` → `placeLineId`
23. Reservation-call `isVenue` → `isPlaceSide` (wire kind `venue_cancel` unchanged)
24. AirlockContext + AgentOpts gain `perplexityModel`
25. `memo-airlock-tools` web_search binds `ctx.perplexityModel`
26. `consumer-web-ask-memo` passes `models_config.memo.perplexity`
27. `admin-web-ask-memo` passes `models_config.memo.perplexity`
28. Stripe webhook → `rejectUnlessMethods` + `jsonError` for config/signature
29. Stripe handler error → `jsonError`
30. ElevenLabs phone compare uses shared `phoneDigits`
31. ARCHITECTURE.md grant-posture section (MESITA-942)
32. ARCHITECTURE.md EF path → `supabase/supabase/functions`
33. `_shared/auth.ts` header: all product EFs (not just business Team)
34. `http.test.ts` covers `jsonOk` / `jsonError`
35. staff-web linklab `venues` alias deprecation note
36. `VISION_MODEL` documented as default when models_config unavailable
37. `reservation-code.ts` nomenclature: venues→places
38. ElevenLabs comments: venue-facing → place-facing
39. Enricher analysis stage binds vision model to `models_config.enricher` when cheap
40. `reservation-callback.ts` nomenclature comments
41. `reservation-retry.ts` nomenclature comments
42. `reservation-run.ts` nomenclature comments
43. `reservation-alternatives.ts` nomenclature comments
44. `reservation-alternatives.test.ts` nomenclature
45. `business-web-get-overview` marks `activeUnitId` `@deprecated`
46. Enricher contents cost comment references `models_config.enricher.model`
47. `supabase/CLAUDE.md` grant-posture one-liner
48. Sync `supabase/AGENTS.md` from CLAUDE.md
49. CI-equivalent `deno lint` clean on package
50. Shared unit tests green (`http`, reservation helpers)
