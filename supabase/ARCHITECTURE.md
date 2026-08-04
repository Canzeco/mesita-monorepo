# Mesita — system architecture

> System map of how Mesita fits together. Lives in the `supabase/` package (the
> backend source of truth) of `Canzeco/mesita-monorepo`. **Notion "Rules" wins
> on any conflict** — this is a stable mirror, not the master. Package
> specifics live in each package's `CLAUDE.md`.

## What Mesita is

Mesita is a dining/experiences platform for Mexico with three audiences, each its
own Next.js app, over one shared Supabase backend:

- **Consumer** (`consumer.mesita.ai`) — discovery (swipe / map / AI concierge),
  reservations, an at-the-bill instant discount, and a Free/**Premium** class.
- **Business** (`business.mesita.ai`) — the business console: manage places, team,
  promos, tickets, and a `free`/`pro`/`ultra` **plan**.
- **Admin** (internal) — super-admin console: settings, verifications, the
  Enricher (place-intelligence) config, per-place inspection.

Plus a **landing** site. The platform sells **experiences**, never holds money
(instant discount at the bill — discounts-only, no wallet), and Mesita only ever
earns via subscriptions (Stripe).

## Repo topology (GitHub org: Canzeco)

**One repo since 2026-07-11: `Canzeco/mesita-monorepo`** — one `.git`, full
history imported from the six former standalone repos (MESITA-455).

| Package | Role | Stack | Deploy |
|------|------|-------|--------|
| `supabase/` | **Source of truth**: DB schema, RLS, ~93 Edge Functions, migrations | Deno / SQL | Supabase cloud |
| `apps/web-consumer` | Consumer app | Next.js (Node 22+) | Vercel |
| `apps/web-business` | Business console | Next.js (Node 22+) | Vercel |
| `apps/web-admin` | Admin console | Next.js (Node 22+) | Vercel |
| `apps/web-landing` | Marketing site | Next.js | Vercel |
| `apps/mobile-consumer` | Native consumer app | Expo SDK 57 / React Native | EAS (human-gated); agents verify via web export |

The six former standalone repos (`mesita-supabase`,
`mesita-web-{admin,business,consumer,landing}`, `mesita-mobile-consumer`) are
frozen read-only history; `mesita-n8n` was retired earlier. Each app package is
an **independent pnpm install root** (deliberately no root workspace — the
mobile app needs the hoisted linker); CI is path-filtered per package.

Coordination lives in **Linear** (team Mesita, `MESITA-`) = work state · **Notion**
= knowledge · **GitHub** = code.

## The one hard boundary: clients call Edge Functions, never the DB

Every web app reads and writes exclusively through Supabase Edge Functions. No app
holds direct table access — the DB is locked down (RLS enabled, EF-only) and the
service role lives only inside EFs. This is the load-bearing invariant of the
whole system.

### EF naming = the ACL: `actor-origin-verb-noun`

Each endpoint encodes exactly one authorized caller from a **closed set**. The name
*is* the access-control contract.

- **Natural callers** (a real audience): `admin` · `business` · `consumer` · `staff`
  · `check` (Tickets v2, MESITA-806 — the PUBLIC check page at
  `mesita.ai/check/<code>`; audience = whoever holds a freshly scanned ticket QR,
  nominally staff. `check-web-*` EFs are `verify_jwt=false`: the 128-bit
  `tickets.check_code` is the whole authentication — see `_shared/ticket-check.ts`).
- **Origin** segment: usually `web` (e.g. `consumer-web-get-profile`).
- **Artificial callers** (machine origins): `supabase-cron-*` (the Enricher
  pipeline), `supabase-edgefunc-*` (internal EF→EF, gated by `X-Internal-Caller`),
  plus vendor webhooks like `stripe-webhook-*`, `twilio-*`, and the four
  Reservationist agents' mid-call server tools — one caller per agent:
  `eleven-a1-*` (c2b outbound Booker) · `eleven-a2-*` (b2c outbound Confirmer)
  · `eleven-a3-*` (consumer inbound support) · `eleven-a4-*` (business inbound
  support), with `eleven-agent-*` as the transitional single-agent caller.
  All share the same locks: anon-key bearer for the gateway + `x-agent-secret`
  matched against `app_settings.agents_config` (impl in `_shared/agent-tools.ts`).
- Natural callers may invoke artificial ones, never the reverse.

Roughly 93 EFs today: business 34 · consumer 24 · admin 18 · plus staff / stripe /
twilio / supabase-cron. `_shared/` holds internal helpers (free-form naming).

## Data layer (Postgres)

Base tables were renamed in the 2026 "R2" pass — the current canonical names:

- **`accounts`** (was businesses) → **`projects`** (was units) → **`places`** (was
  venues). `projects_view` is the consumer-facing browse view and is
  `SECURITY INVOKER` (MESITA-599): consumer browse reads it with the anon key
  and relies on RLS (`projects_select_public_visible`), so any create-or-replace
  MUST keep `with (security_invoker = true)`.
- **Consumers** carry a **class** (`classes` table + `consumers.class_*`);
  **accounts** carry a **plan**. Enum type `membership` is retained.
- Per-place member roles: `owner` / `editor` / `viewer` (enum `member_role`).
- Other domains: tickets (the at-the-bill discount workflow, the only Realtime
  consumer), billing (Stripe subscriptions), verifications, invites, and the
  Enricher's `place_research` staging + `app_settings` config singleton.

RLS note: many tables are deliberately `rls_enabled_no_policy` — that is the
EF-only lockdown, *not* a missing-policy bug. Adding policies would *open* access.

## The Enricher (place intelligence)

Legacy-branded "Atlas" (hence `atlas_*` columns / `atlas-config` routes). It is a
**process, not an agent** — a cron-driven pipeline of three EFs over the
`place_research` stage table, judged by DB effects (not green beacons):

1. **`supabase-cron-enrich-place-research`** — S1 Google identity gate → S2 Apify
   Google Maps reviews/images ‖ Perplexity SERP summary (**Agent X**) → S3 channel
   discovery: per-source Firecrawl **Search** gather (S4) → single Perplexity
   **Agent Y** "Review & Select Links" pass (S5), leniency FP > FN, phone/email
   folded in → Instagram/Facebook gather.
2. **`supabase-cron-enrich-place-contents`** — download verified links' material
   (Apify) + mirror images to storage.
3. **`supabase-cron-enrich-place-analysis`** — vision-describe → rank → synthesize
   the About / category / tags.

A `pg_cron` poller claims staged rows and fires each EF. Config knobs live in
`app_settings` (`atlas_*`), edited from the admin console. **Full runs burn real
Apify/Perplexity/Firecrawl budget** — deploying/arming the cron is money-gated.

## Agents (distinct from the Enricher process)

- **Memo** — consumer AI concierge (`consumer-web-ask-memo`), the Home "Ask AI"
  tab. Perplexity `sonar-pro` + Google Places + the Mesita catalog. Persona
  "Don Memo" (Spanish-first voice).
- **Reservationist** — voice reservations on ElevenLabs (config under
  `integrations/elevenlabs`). Every timing rule — when a1 retries the venue,
  the negotiation cap, and the two legs that have **no** protocol yet (the
  guest callback and ticket expiry) — is written down in
  [`RESERVATIONS-PROTOCOL.md`](./RESERVATIONS-PROTOCOL.md). Read it before
  changing anything about when a call fires.

## Billing

Stripe subscriptions only (no money held). Business `pro` / `ultra`, consumer
`premium`. Webhook handled by `stripe-webhook-handle-event`. Going fully live
(real charges, live-mode) is human-gated.

## Working conventions (see the Rules quickstart in every CLAUDE.md)

- **Reply in English.** Branch off fresh `main`; never push to `main`; squash-PR.
- **Mirror every Supabase cloud change into the `supabase/` package the same
  session**; after any EF deploy verify cloud == repo (a smoke-test stub once
  clobbered prod).
- Run all `supabase` commands from inside `supabase/` (single migration
  ledger). Prod EF deploys + sensitive DDL are gated.
- **No local dev servers** — verify web apps via their Vercel deploy.
- Light theme + semantic tokens across every web app.
- CI: web apps `lint · typecheck · build` (Node 22+); supabase `deno lint · test`.
