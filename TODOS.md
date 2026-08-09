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
