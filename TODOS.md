# TODOS

## Design debt

- [x] **Admin console DESIGN.md** — document live `apps/web-admin` system (tokens, type roles, component vocabulary, canonical paths).
  - **Done (2026-08-09):** shipped `apps/web-admin/DESIGN.md` + root `DESIGN.md` pointer via `/autoplan` (inventory of live code; `/design-consultation` skipped — system already shipped; dualities labeled debt).
  - **Why:** every design review calibrates against an implicit system; writing it down keeps new pages and reviews consistent.
  - **Context:** surfaced by /plan-design-review of the Promos Config rebuild
<<<<<<< HEAD
    (2026-08-09) — Pass 5 flagged the missing DESIGN.md.

- [ ] **Admin shared UI kit** — extract one SectionCard / Save / Error / control set from the three lakes (`atlas-ui`, `manage-single/ui`, `panel-ui`), then shrink the debt section in `apps/web-admin/DESIGN.md` to a pointer.
  - **Why:** DESIGN.md documents forks as debt; without extraction, greenfield still drifts toward the nearest sibling.
  - **Pros:** one import path for new pages; reviews argue less. **Cons:** multi-file migrate; Lineup panel idioms may stay specialized.
  - **Depends on:** Admin console DESIGN.md (done).
=======
    (2026-08-09) — Pass 5 flagged the missing DESIGN.md; review proceeded on the
    console's implicit system (SectionCard/SaveRow template, semantic light tokens).
  - **Depends on:** nothing.

- [ ] **Manage Single — Products own tab (deferred)** — only if Place density
  still hurts after residual E-R* polish under MESITA-900.
  - **Why:** /autoplan (2026-08-09) cancelled Place·Products·Promos·Reviews·Team
    resurrection; kept Products embedded (D4). Revisit only with evidence.
  - **Pros:** Focused Place. **Cons:** Extra tab / catch-all churn.
  - **Depends on:** shipping residual E-R1–E-R10 from `.claude/plans/manage-single-tabs.md`.

>>>>>>> f815e080 (docs(admin): autoplan cancels manage-single tab split; residual E-R*)
