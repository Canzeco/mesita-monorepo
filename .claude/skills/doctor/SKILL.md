---
name: doctor
description: Weekly read-only audit of the Mesita stack — the database, config, deploy, Docs and claim checks the pipeline-audit workflow cannot run. Publishes a dated Linear issue (Done on creation), files P0/P1 findings as issues, never fixes anything.
---

# Doctor — weekly stack audit

A read-only diagnostician for First Stage: the three `apps/web-*` and `supabase/`. Once a week, find **incongruences** (two sources of truth that disagree) and **decay** (healthy last week, not now), and write one report.

The mechanical checks are not yours: `scripts/pipeline-audit.ts` runs every Monday in `.github/workflows/pipeline-audit.yml`, and 1.1 reads its last run. Never repeat them.

## Hard rules

1. **Read-only.** SELECT only. Write nothing but Linear issues and comments (never documents); an obvious fix goes in the report, unapplied.
2. **Evidence.** Each finding carries the query, command or `file:line` behind it and the two values that disagree. Re-run last week's findings, never copy them.
3. **Cloud is a singleton** (I-5): compare the live cloud with `origin/main`, never a working tree.
4. **Diff against last week:** each finding is `NEW`, `PERSISTING (n weeks)` or `RESOLVED`.
5. **Never ask.** Make the call, state the assumption, keep going.
6. **30 minutes.** Cut from the bottom and name each skipped scope. A scope whose connector is missing is `SKIPPED (connector unavailable)`, never `OK`.

Inputs: `origin/main` (fetch first), Supabase MCP (SELECT only), Linear (team Mesita), Notion (📜 Rules, 📚 Docs), Vercel MCP, `gh`.

## Scope 1 — Pipeline and knowledge · P1

1.1 **Pipeline audit.** `gh run list --workflow pipeline-audit.yml --branch main --limit 1`: older than 8 days or not a pass is a finding; copy its unaccepted codes. It reads the required checks live from the ruleset, so never state a count.
1.2 **Stamp.** Rules §0's Mirror line against `scripts/rules-quickstart.md`, both `stamp: v<N> <date>`. Unequal is drift: put the exact corrected text in the issue.
1.3 **Mirror.** Merged PRs of the last 7 days with `Docs: notion:<id>`: a page last edited before the merge is "Mirror missing". `Docs: none — <why>` is OK; a `handoff` is `TRACKED` until 7 days old.
1.4 **Claims** (I-6). In Progress issues idle over 24 h. From the shared checkout, `deno task worktree sweep` (dry run): `sweepable` rows, the `json:` counts, and every `origin-json` claim whose issue is not In Progress, or the reverse.
1.5 **Docs against code.** Each 📚 Docs domain page against the code it names: every disagreeing claim, with `file:line` and both values. Index links resolve, one page per domain. Drift the page declares, or an open issue names, is `TRACKED`.
1.6 **Vocabulary.** The banned list on 📚 Docs › Vocabulary, swept across the repo (not `supabase/supabase/migrations/`, frozen history) and the Docs pages.

## Scope 2 — Backend congruence · P0

2.1 **Migration ledger.** `list_migrations` against `supabase/supabase/migrations/`: a file with no row, or a row with no file (applied off-repo, the dangerous one).
2.2 **Schema drift.** A live table, column, view, function or policy no migration creates.
2.3 **Applied, not live.** A ledger row records intent, not execution. Derive the data-only migrations each run (an `update` or `insert into public.` that creates nothing) and re-check the values they assert; confirm a moved column or renamed table first. P0 when a shipped surface advertises the value.
2.4 **Reset coverage.** `admin_reset_database` still reads `public.admin_reset_preserve` and asserts its survivors (`app_config`, `super_admins`, the vocabularies) before truncating; every registry row is a real base table; every other base table is wiped.
2.5 **Client-readable views must read.** A `security_invoker` view is only as readable as its body; `profiles` must stay `security_invoker = true`. Any row is a P0:

```sql
select role_name, v.relname as view, d.refobjid::regclass::text as base, a.attname
  from unnest(array['anon','authenticated']) as role_name
  cross join pg_class v
  join pg_namespace n on n.oid = v.relnamespace and n.nspname = 'public'
  join pg_rewrite r on r.ev_class = v.oid
  join pg_depend d on d.objid = r.oid and d.classid = 'pg_rewrite'::regclass
  join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
 where v.relkind = 'v' and v.reloptions @> array['security_invoker=true']
   and d.refobjid <> v.oid and d.refobjsubid > 0
   and has_table_privilege(role_name, v.oid, 'SELECT')
   and not has_column_privilege(role_name, d.refobjid, a.attnum, 'SELECT');
```

2.6 **Hand deploys.** A function updated in the cloud after the last push to `main` skipped the integration: diff its body (`get_edge_function`) against `origin/main`.

## Scope 3 — Postgres health · P1

3.1 **Advisors.** `get_advisors`, security and performance: every lint, with its object.
3.2 **RLS.** RLS on for every `public` table; no policy grants `anon` more than intended. RLS with no policy is the deliberate function-only lockdown (`supabase/CLAUDE.md`), not a finding.
3.3 **Stored bodies.** `extensions.plpgsql_check_function_tb` over every `public` plpgsql function, triggers against their table (`pg_trigger.tgrelid`): any `error` or `fatal` row is a P0. It misses `EXECUTE` strings, `LANGUAGE sql` and cron commands, so after a rename or drop grep `pg_proc.prosrc` and `cron.job.command` for the old name.
3.4 **Schedulers.** From `cron.job_run_details`, each active job's failures and last success over the last day. All runs failed, or no success inside three times its cadence, is a P0.
3.5 **Hygiene** (P2). Unindexed foreign keys, unused or duplicate indexes, dead tuples, the `pg_stat_statements` top 20, `idle in transaction` over 5 minutes, extensions in `public`.

## Scope 4 — Data integrity · P1

4.1 **Orphans.** Rows pointing at a deleted place, profile or reservation.
4.2 **Taxonomy.** Every category, family and tag value is in `place_categories`, `place_families` or `place_tags`.
4.3 **Places.** Coordinates inside Mexico, parseable hours, a `google_place_id`, and no `google_place_id` or name-and-location pair on two places.
4.4 **Media.** References that 404 in `place-images`, `menu-images` or `menu-pdfs`; objects nothing references; a file in the wrong bucket.
4.5 **Enrichment.** Places stuck in `content_state = generating`; runs with no terminal state.

## Scope 5 — Config and boundaries · P1

5.1 **Config pages** (`CONFIGURATIONS_NAV` in `apps/web-admin/src/components/Sidebar.tsx`; never copy it here). Per page: the `app_config` blob matches its readers' shape (a reader silently falling back to defaults is the commonest invisible bug); every field has a reader; no code constant overrides a field, the rate card included (`enricher-config/cost-model.ts` against `_shared/enrich-config.ts`); saving waits on `loadError`.
5.2 **Clients never touch the database.** No `supabase.from(` or `.rpc(` in app code.
5.3 **Callers.** Each function's prefix is a caller on 📚 Docs › Functions; natural callers may call artificial ones, never the reverse; a function nothing calls, or a call to a missing function, is a finding.

## Scope 6 — Deploys and runtime · P2

6.1 **Vercel.** The three projects (web-admin, web-consumer, web-landing) point at `Canzeco/mesita-monorepo`, Root Directory `apps/web-<app>`, "skip unaffected" on; last production deploy green; build and runtime errors.
6.2 **Env parity.** Each app's keys against its Vercel project; every `Deno.env.get(...)` against the Supabase secrets. Names only, never values.
6.3 **Dependencies.** Lockfile against manifest, overrides outside `pnpm-workspace.yaml`, known-vulnerable packages.
6.4 **Logs.** Error rate and new error signatures per function; OTP failure spikes.
6.5 **Vendors.** Error rates and credit headroom for Google Places, Firecrawl, Perplexity, Apify, Twilio and ElevenLabs: an exhausted credit shows up as bad data.

## Scope 7 — Ledger · P3

7.1 Merged PRs whose `Closes MESITA-…` issue is still open.
7.2 Open issues missing a Domain label, a `Footprint:` line, a `Done:` line or a project.
7.3 Open issues whose premise is already false.

## Procedure

1. Fetch, then audit `origin/main`.
2. Last week's report is the newest Linear issue `Doctor — YYYY-MM-DD` (team Mesita, project Ops & maintenance, Done included); none means `BASELINE`.
3. Run scopes 1–7, in parallel inside each. Each finding: check, severity, both values, evidence, one-line fix, blast radius.
4. Re-run every P0 and P1; drop what does not reproduce.
5. Publish the report as this week's issue, Done in the same call.
6. File each new P0 or P1 as `doctor: <symptom>`; when an open issue covers it, comment there.
7. Print the verdict, the P0/P1 list and what resolved.

**Severity.** P0: production is wrong now, or cloud and repo split in a way a deploy worsens. P1: silently wrong output or near-term breakage. P2: decay, cost, hygiene. P3: paperwork. A finding `PERSISTING` 3 weekly runs moves up a tier, filed as `doctor: <symptom> — PERSISTING <n> weeks`; `RESOLVED` or a won't-fix close ends the count.

## Report shape

```markdown
# Doctor — YYYY-MM-DD

**Verdict:** HEALTHY | DEGRADED (n P1) | CRITICAL (n P0)
**Scopes run:** 1–7 (skipped: none) · **origin/main:** <sha> · **pipeline audit:** <result, date, run url>

## Diff vs YYYY-MM-DD
- NEW: … · PERSISTING (n weeks): … · RESOLVED: …

## Findings
### [P0] 2.5 — <one-line symptom>
- live: … · repo: … · evidence: … · fix: … · blast radius: … · linear: MESITA-…

## Scope ledger
| Scope | Checks | OK | Findings | Skipped |

## Metrics
Database size · largest tables · function count · advisor counts · error rate · orphan rows · dead config fields
```

Keep the metrics block's shape the same every week: it is the time series.
