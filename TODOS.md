# TODOS

## Design debt

- [x] **Admin console DESIGN.md** — document live `apps/web-admin` system (tokens, type roles, component vocabulary, canonical paths).
  - **Done (2026-08-09):** shipped `apps/web-admin/DESIGN.md` + root `DESIGN.md` pointer via `/autoplan` (inventory of live code; `/design-consultation` skipped — system already shipped; dualities labeled debt).
  - **Why:** every design review calibrates against an implicit system; writing it down keeps new pages and reviews consistent.
  - **Context:** surfaced by /plan-design-review of the Promos Config rebuild
    (2026-08-09) — Pass 5 flagged the missing DESIGN.md.

- [x] **Admin shared UI kit** — extract config/manage/lineup chrome into `apps/web-admin/src/components/admin-ui/`; route-local files are re-export shims; DESIGN.md points at the kit.
  - **Done (2026-08-09):** `@/components/admin-ui` (`config` · `manage` · `lineup` + barrel). Visual variants kept; one import root.
  - **Depends on:** Admin console DESIGN.md (done).

- [ ] **Manage Single — Products own tab (deferred)** — only if Place density
  still hurts after residual E-R* polish under MESITA-900.
  - **Why:** /autoplan (2026-08-09) cancelled Place·Products·Promos·Reviews·Team
    resurrection; kept Products embedded (D4). Revisit only with evidence.
  - **Pros:** Focused Place. **Cons:** Extra tab / catch-all churn.
  - **Depends on:** residual E-R1–E-R10 (shipped).

## Data debt

- [ ] **Retain prior Google names for search recall** — keep superseded
  `places.google_name` values (array column or `place_name_history`) and add a
  third leg to the ILIKE search OR.
  - **Why:** `google_name` is overwritten in place on every re-enrich, so a
    rebrand destroys the old Google string. A consumer searching the name they
    remember from Google Maps gets zero results for a place that is in the
    catalog. Also gives the Enricher an audit trail of what Google said and when.
  - **Pros:** Search survives rebrands; real evidence when debugging a surprise
    rename. **Cons:** New write path, third search leg, growth/pruning question.
  - **Context:** /plan-eng-review (2026-08-09) D2 option C. Pato picked option A
    (stop copying Google into `name`), which is strictly the smaller model and
    leaves this gap open on purpose. Unexercised today: 1 place, 0 rebrands.
    Revisit when a post-rebrand search miss is actually reported.
  - **Depends on:** the 1A restructure landing first — history only makes sense
    once `google_name` is unambiguously a cached observation, not a spine.

## Infra debt

- [ ] **SQL test harness in backend CI** — pgTAP or a `supabase start` step in
  `.github/workflows/supabase.yml`, so schema invariants are tested per PR.
  - **Why:** backend CI runs `deno lint` + `deno test` only, with no database
    attached. Every SQL invariant here is protected by convention alone:
    `projects_view` must keep `security_invoker`, `admin_reset_database` must
    preserve its registry rows, and (after the naming restructure) the generated
    `places.name` column and its CHECK. One has already failed silently —
    migration `20260712040000` dropped `security_invoker` from `projects_view`
    and it went unnoticed until an audit.
  - **Pros:** catches schema regressions at PR time instead of at deploy or in
    production; gives future invariants somewhere real to live.
    **Cons:** new CI subsystem with Postgres startup cost on every backend PR.
  - **Context:** /plan-eng-review (2026-08-09) Issue 5 option 5B. Pato picked 5A
    (migration DO-block assertions + a Deno source guard), which verifies at
    deploy time with no new infra. 5A's known blind spot is a *later* migration
    dropping the generated column or constraint on an already-migrated database;
    this harness is what closes it.
  - **Depends on:** nothing — can land independently at any time.
