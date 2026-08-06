# MESITA-941 — database cleanup round 2 (50 iterations)

Follow-up to MESITA-940 / PR #727. Each item is one focused improvement.

1. Revoke `PUBLIC`/`anon`/`authenticated` EXECUTE on `generate_consumer_code`
2. Revoke same on `seed_place_categories` / `seed_place_tags`
3. Revoke same on trigger-only `set_updated_at` / `sync_place_category_label`
4. `projects_view`: client roles SELECT-only (drop DML/TRUNCATE/TRIGGER grants)
5. Document intentional `is_super_admin` / `is_project_member` authenticated EXECUTE (Storage RLS)
6. COMMENT EF-only tables (`accounts`, `tickets`, `reservations`, `super_admins`, `app_settings`, `reward_rules`)
7. Partial index `reservations_due_notice_idx` for cancel-notice cron
8. Partial index `reservations_due_callback_idx` for guest-callback cron
9. ARCHITECTURE: DEFINER grant policy note (advisor 0029 accepted cases)
10. Delete stub root `supabase/package-lock.json`
11. Docs: `TICKET_SEQUENCES.md` `web-checkout`→`web-check`, MESITA-814
12. `_shared/identity.ts` → canonical `methodNotAllowed()`
13. New `_shared/models-config.ts` (`loadModelsConfig`)
14. New `_shared/embeddings-http.ts` (dedupe OpenAI embed HTTP)
15. `embeddings.ts` reads `models_config.lineup.model`
16. `place-embeddings.ts` reads enricher + lineup models; uses embeddings-http
17. `tags.ts` optional model param (default tagger)
18. `categories-infer.ts` optional model param
19. Enricher contents stage passes `models_config.enricher.model` into tag/category inference
20. `supabase-edgefunc-get-memo-config` prefers `models_config.memo.*`
21. `memo-data` exposes `perplexity` from Models page
22. `consumer-web-ask-memo` agent path uses `cfg.model` (retire `MEMO_MODEL` env)
23. Ask-memo Perplexity path uses `cfg.perplexity`
24. `admin-web-ask-memo` default model → `gpt-4o-mini`
25. `business-web-suggest-promo` binds `models_config.supabase.model`
26. `recommender-rank-map` category LLM binds `models_config.supabase.model`
27. `serveEnrichStage` uses `rejectUnlessMethods`
28. Bulk adopt `rejectUnlessMethods` across ~122 POST-only EFs
29. Drop `venue:` response alias on `admin-web-create-project`
30. Admin create helper drops `data.venue` fallback
31. `business-web-list-team` response key `businesses`→`members`
32. web-business Team API/UI → `members`
33. web-admin TeamSnapshot/TeamSection → `members`
34. Reservation phone map key `venue`→`place` (list-reservations + place-activity)
35. web-business/web-admin callers updated for `lines.place`
36. `stripe-webhook-handle-event` canonical JSON error shapes
37. `readPlaceIdAlias` on `admin-web-enrich-place`
38. `readPlaceIdAlias` on `admin-web-get-place-enrichment`
39. `readPlaceIdAlias` on `admin-web-list-verifications`
40. Rename misnamed `lineup-config-validate.ts` under scoring EF → `scoring-config-validate.ts`
41. `enrich-google-basics` comment: Unit-level → Project-level
42. `create-quota` comment: schedule alias clarified
43. `consumer-web-schedule-project-creation` sunset/alias note (MESITA-941)
44. `admin-web-get-models-config` header: STAGED → live binding
45. `auth-membership` documents legacy `staff` role (0 expected rows)
46. `ManagersTeamSection` type uses `TeamSnapshot["members"]`
47. `memo-answer` accepts configurable Perplexity model
48. Align repo migration filenames with MCP cloud stamps
49. CI-equivalent `deno lint` clean on package
50. Shared unit tests green (`http`, `embeddings-vector`)
