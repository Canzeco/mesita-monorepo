# TODOS

## Design debt

- [ ] **Admin console DESIGN.md** — run `/design-consultation` for `apps/web-admin`
  and commit a DESIGN.md (tokens, type scale, component vocabulary).
  - **Why:** every design review calibrates against an implicit system; writing it
    down keeps new pages and reviews consistent.
  - **Pros:** faster future reviews, no idiom drift. **Cons:** ~1h; idiom already stable.
  - **Context:** surfaced by /plan-design-review of the Promos Config rebuild
    (2026-08-09) — Pass 5 flagged the missing DESIGN.md; review proceeded on the
    console's implicit system (SectionCard/SaveRow template, semantic light tokens).
  - **Depends on:** nothing.

## Manage Single Unit

- [ ] **Place tab density (MESITA-900 shell)** — declutter Place masonry without
  changing the live tab IA (`place · promos · performance · settings · admin`).
  - **Why:** Products still nests on Place (~812 LOC card); PlaceSection ~1204 LOC.
    The superseded tabs plan admitted it did not declutter — that remains the
    higher-leverage ops win after residual chrome polish.
  - **Pros:** faster place readiness. **Cons:** needs its own design pass; do not
    re-split Products/Reviews/Team into top-level tabs (Pato MESITA-900).
  - **Context:** surfaced by /autoplan on `manage-single-tabs.md` (2026-08-09).
  - **Depends on:** residual polish plan (R1–R9) optional but not blocking.
