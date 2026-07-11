<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# supabase — DB · RLS · Edge Functions (source of truth)

> Monorepo-wide rules: root [`CLAUDE.md`](../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- **New here? Read [`ARCHITECTURE.md`](./ARCHITECTURE.md)** — the system map (audiences, topology, EF caller taxonomy, data layer, the Enricher pipeline, agents, billing).
- Run every `supabase` command from **this package** (`<repo>/supabase` — CLI config lives at `supabase/config.toml` inside it). All Supabase files live only here — kill stray `supabase/` config stubs anywhere else in the monorepo (a stray stub links against a divergent migration ledger).
- **EF name = the ACL:** `actor-origin-verb-noun`, exactly one caller per endpoint from the closed set. `_shared/` holds shared code (internal naming free-form). Only `supabase-edgefunc-*` endpoints accept the internal caller; the origin propagates via `X-Internal-Caller`.
- **Mirror + verify:** every cloud change (schema/RLS/EF) mirrors into this package the same session. After any EF deploy, confirm cloud == repo (`get_edge_function`) — a smoke-test stub once silently clobbered prod.
- **Migrations:** MCP `apply_migration` stamps its own server-side timestamp ≠ the repo filename — reconcile `schema_migrations` after, or the next `db push` re-runs those files. Prod EF deploys + security-sensitive DDL are gated by the harness classifier — attempt a `supabase …` command once cleanly, else hand off a `deploy:` step.
- **Don't "fix" these:** `projects_view` is intentionally `SECURITY DEFINER` (accepted advisor 0010 exception — flipping to invoker hides non-active places from consumer browse); `rls_enabled_no_policy` tables are the deliberate EF-only lockdown (adding policies OPENS access).
- Supabase Realtime is for ticket workflows only. After architectural changes, update `admin_reset_database`. The Enricher is a **cron EF pipeline** (`supabase-cron-enrich-place-{research,analysis,contents}`), not an agent — judge it by DB effects, not green beacons.
- CI: `supabase.yml` — deno lint · test (Deno toolchain, no Node build), path-filtered to `supabase/**`. Instruction-file sync check = root `rules.yml`.
