# supabase — DB · RLS · Edge Functions (the source of truth)

> Read root [`CLAUDE.md`](../CLAUDE.md) first. Package law only: the tests named here pin the rest. Notion Docs: Atlas, Create · Enrich · Edit, Reservations, Functions.

- **Run every `supabase` command from this package:** the CLI config is `supabase/config.toml`, and a Supabase config anywhere else links a divergent migration ledger.
- **The EF name is the ACL:** its prefix names its one caller, from the closed set `consumer` · `admin` · `enricher` · `eleven` · `supabase` · `meta` (Rules §2). A function calls another only through `_shared/internal.ts`. `_shared/ef-caller-acl.test.ts` pins which app calls what.
- **Retiring an EF** = delete its folder, its `[functions.<slug>]` block and every call to it (`ef-config-manifest.test.ts`, `app-ef-calls-exist.test.ts`). `scripts/cleanup-retired-efs.sh` deletes the cloud copy at least 3 days later (`leftover-efs.test.ts`). A rename is a retirement.
- **Repo first (I-5):** schema reaches the cloud only through a merged migration; Supabase's GitHub integration applies it on merge and deploys every `config.toml` function. Never MCP `apply_migration` ahead of the PR: its version stamp makes the merge re-run it. `scripts/deploy.sh` only repairs a failed integration run. Confirm cloud == repo after any cloud change (`get_edge_function`). Once a migration is live, `scripts/regen-types.sh` regenerates the committed types.
- **RLS:** `profiles` runs as `security_invoker` (pgTAP pins it), so the anon key reads it under RLS. A table with RLS on and no policy is the deliberate EF-only lockdown: adding a policy opens it. Client roles hold nothing on EF-only tables and only SELECT on browse and vocabulary tables.
- **Pinned by pgTAP and `_shared/` tests:** `place_profiles.name` is generated, so no write names it (`place-name-writes.test.ts`); a table that must survive `admin_reset_database` is a row in `public.admin_reset_preserve`, never an edit to the function; Storage is purged through the Storage API (`storage-purge.test.ts`).
- **The Enricher** is Notion Docs › Create · Enrich · Edit; judge a run by its DB effects (place fields, media), never green beacons.
