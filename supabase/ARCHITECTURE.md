# Mesita — system architecture

> System map of how Mesita fits together. Lives in the `supabase/` package (the
> backend source of truth) of `Canzeco/mesita-monorepo`. **Notion "Rules" wins
> on any conflict** — this is a stable mirror, not the master. Package
> specifics live in each package's `CLAUDE.md`.

## What Mesita is

Mesita is a dining/experiences platform for Mexico with four web audiences plus
mobile, over one shared Supabase backend:

- **Consumer** (`consumer.mesita.ai` + `apps/mobile-consumer`) — discovery
  (swipe / map; Ask AI / Memo parked on Home), reservations, at-the-bill
  discounts, and a **class** ladder Standard / Premium / Influencer / Aura
  (doors model MESITA-972 — slot is the highest open door).
- **Business** (`business.mesita.ai`) — console: places, team, promos, tickets,
  reservations; **plan** `free`/`pro`/`ultra` (product copy: Listed vs Verified
  / Mesita Membership — `business_verified_yearly`, MESITA-912).
- **Check** (`check.mesita.ai` — `apps/web-check`) — public staff check page for
  Tickets v2; QR capability-URL auth (`check-web-*`, `verify_jwt=false`).
- **Admin** (`admin.mesita.ai`) — super-admin console: binding configs (Atlas /
  Enricher / Sourcing / Memo / Reservations / Lineup / Models / Rewards /
  Verification), verifications, per-place inspection.

Plus a **landing** site and scaffold-only `apps/mobile-business`. The platform
never holds money (discounts-only); Mesita earns via subscriptions (Stripe) —
consumer Premium is the revenue stream; place membership is legitimacy/framing.

## Repo topology (GitHub org: Canzeco)

**One repo since 2026-07-11: `Canzeco/mesita-monorepo`** — one `.git`, full
history imported from the six former standalone repos (MESITA-455).

| Package | Role | Stack | Deploy |
|------|------|-------|--------|
| `supabase/` | **Source of truth**: DB schema, RLS, ~138 Edge Functions, migrations | Deno / SQL | Supabase cloud |
| `apps/web-consumer` | Consumer app | Next.js (Node 22+) | Vercel |
| `apps/web-business` | Business console | Next.js (Node 22+) | Vercel |
| `apps/web-admin` | Admin console | Next.js (Node 22+) | Vercel |
| `apps/web-landing` | Marketing site | Next.js | Vercel |
| `apps/web-check` | Mesita Check (staff) | Next.js (Node 22+) | Vercel → check.mesita.ai |
| `apps/mobile-consumer` | Native consumer app | Expo SDK 57 / React Native | EAS (human-gated); agents verify via Metro web + `expo export` |
| `apps/mobile-business` | Native business app | Expo SDK 57 | Scaffold only (EAS wired, no screens) |

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
  `check.mesita.ai/<code>`; audience = whoever holds a freshly scanned ticket QR,
  nominally staff. `check-web-*` EFs are `verify_jwt=false`: the 128-bit
  `tickets.check_code` is the whole authentication — see `_shared/ticket-check.ts`.
  Old `mesita.ai/check/<code>` QRs permanently redirect via web-landing — MESITA-814).
  Closed-set ACL names use the `*-web` / `eleven-a*` / `stripe-webhook` /
  `consumer-mcp` / `staff-web` prefixes from Product Rules §A; mobile apps call
  `consumer-web-*` / (future) `business-web-*` — there are no `consumer-mobile-*`
  endpoints today.
- **Origin** segment: usually `web` (e.g. `consumer-web-get-profile`); also
  `mcp` for the live `consumer-mcp` endpoint.
- **Internal callers** (machine origins): `supabase-cron-*` (the Enricher
  pipeline), `supabase-edgefunc-*` (internal EF→EF, gated by `X-Internal-Caller`).
- **Vendor callers**: `stripe-webhook-handle-event` (Stripe; folder slug, not a
  bare `stripe-webhook` prefix), and the four Reservationist agents' mid-call
  server tools — one caller per agent: `eleven-a1-*` (c2b outbound Booker) ·
  `eleven-a2-*` (b2c outbound Confirmer) · `eleven-a3-*` (consumer inbound
  support) · `eleven-a4-*` (business inbound support), with `eleven-agent-*` as
  the transitional single-agent caller. The product agent Reservationist runs
  as these `eleven-*` tools; there is no `reservationist-agent` folder prefix
  (code folders under `supabase/supabase/functions/` are SoT for live folder
  names; Notion Product Rules §A lists the closed-set ACL, including
  `check-web` and `eleven-a*`). ElevenLabs tools
  share the same locks: anon-key bearer for the gateway + `x-agent-secret`
  matched against `app_settings.agents_config` (impl in `_shared/agent-tools.ts`).
  `twilio-webhook` / `business-whats` / `guest-web` are retired
  (`twilio-webhook` WhatsApp rail removed 2026-08-03).
- **Active folder prefixes (LIVE census):** `admin-web` · `business-web` ·
  `consumer-web` · `check-web` · `staff-web` · `consumer-mcp` · `eleven-a1` ·
  `eleven-a2` · `eleven-a3` · `eleven-a4` · `eleven-agent` · `supabase-cron` ·
  `supabase-edgefunc` · `stripe-webhook-handle-event`.
- Product callers may invoke internal ones, never the reverse.

138 EFs today (folders under `supabase/supabase/functions/`, excl. `_shared`).
`_shared/` holds internal helpers (free-form naming).

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

Grant posture (MESITA-942/943): EF-only tables revoke **all** privileges from
`anon`/`authenticated` (defense in depth on top of zero policies). Browse /
vocabulary tables (`places`, `projects`, `classes`, `place_categories`,
`place_tags`, `consumers`, `projects_view`) are **SELECT-only** for client
roles — DML/TRUNCATE/TRIGGER/REFERENCES revoked. Sequences are service_role-only.
Browse RLS policies target `anon`/`authenticated` explicitly (not `PUBLIC`);
`consumers_select_self` is `authenticated`-only (MESITA-943).

DEFINER helpers `is_super_admin` / `is_project_member` keep authenticated EXECUTE on purpose (Storage RLS); mutators and trigger-only RPCs are service_role-only (MESITA-940/941). Model string defaults across EFs resolve through `_shared/models-config.ts` (`DEFAULT_MODELS_CONFIG`) so hardcoded fallbacks cannot drift from the Models page seed.

**Admin Reset survivors** live in `public.admin_reset_preserve` (EF-only registry).
`admin_reset_database()` discovers every `public` base table at run time and
truncates all except those rows — admin configs (`app_settings`), `super_admins`,
`reward_rules`, and vocabularies survive; operational data does not. A table that
must survive a wipe is an `INSERT` into the registry, never a keep-list paste
into the function body.

## The Enricher (place intelligence)

Legacy-branded "Atlas" (hence `atlas_*` columns and the writer EF
`admin-web-update-atlas-config`). **Atlas Config** (`/atlas-config`) is the
profile-spec (fields, vocabularies, who-can-edit). **Enricher Config**
(`/enricher-config`) is the pipeline behavior. The Enricher is a **process, not
an agent** — a cron-driven pipeline of three EFs over `place_research`, judged by
DB effects (not green beacons). Canonical stage order (code SoT —
`_shared/enrich-pipeline.ts`): **research → analysis → contents → done**.

1. **`supabase-cron-enrich-place-research`** — S1 Google identity gate → S2 Apify
   Google Maps reviews/images ‖ Perplexity SERP summary (**Agent X**) → S3 channel
   discovery: per-source Firecrawl **Search** gather (S4) → single Perplexity
   **Agent Y** "Review & Select Links" pass (S5), leniency FP > FN, phone/email
   folded in → Instagram/Facebook gather.
2. **`supabase-cron-enrich-place-analysis`** — vision-describe → rank → synthesize
   the About / category / tags.
3. **`supabase-cron-enrich-place-contents`** — download verified links' material
   (Apify) + mirror images to storage + seed Selected Reservation Endpoint.

A `pg_cron` poller claims staged rows and fires each EF. Pipeline knobs live in
`app_settings` (`atlas_*`), edited from Enricher Config. **Full runs burn real
Apify/Perplexity/Firecrawl budget** — deploying/arming the cron is money-gated.

## Agents (distinct from the Enricher process)

- **Memo** — consumer AI concierge (`consumer-web-ask-memo`). Home Ask AI / Memo
  tab is currently **parked** (`soon: true` on web + mobile); engine + admin
  Playground remain live. Perplexity `sonar-pro` + Google Places + the Mesita
  catalog. Persona "Don Memo" (Spanish-first voice — Product Rules greeting;
  client hardcode may lag). Dogfooded from the admin Playground via
  `admin-web-ask-memo`, which runs the identical shared engine (`_shared/memo-*`).
  - **INVARIANT: Memo holds no database client.** Every Mesita read — on the
    reasoning-agent engine AND the legacy pipeline — goes through
    `_shared/memo-data.ts` to a closed set of four read-only internal EFs:
    `supabase-edgefunc-{recall-lineup, search-places, get-consumer-context,
    get-memo-config}`. Each owns its own SELECT and projects to a public shape,
    so the column whitelist lives at the source, not in the agent. This is the
    reach half of the airlock (`_shared/memo-airlock.ts` is the capability half):
    the model can only call a whitelisted tool, and a tool can only call a
    whitelisted endpoint — there is no generic query capability inside to be
    injected toward. Adding an endpoint means adding a row to the admin console's
    Memo Config → **Data Access** tab in the same PR; that page is the
    operator-facing mirror of this set.
- **Reservationist** — voice reservations on ElevenLabs (config under
  `integrations/elevenlabs`). Every timing rule — when a1 retries the venue,
  the negotiation cap, and the two legs that have **no** protocol yet (the
  guest callback and ticket expiry) — is written down in
  [`RESERVATIONS-PROTOCOL.md`](./RESERVATIONS-PROTOCOL.md). Read it before
  changing anything about when a call fires.

## Identity & sign-in

Three audiences, three doors, one `auth.users` pool:

| Audience | Door | Post-sign-in EF |
| --- | --- | --- |
| Consumer | **Phone OTP only** (Twilio SMS) — no email, no OAuth, no guest | `consumer-web-signin-phone` |
| Business | Email + password | `business-web-signin-email` |
| Admin | Email / OAuth, gated by `public.super_admins` | — |
| Check (staff) | **No account** — possession of `tickets.check_code` | `check-web-*` (`verify_jwt=false`) |

The post-sign-in EF is housekeeping, not authentication: Supabase Auth has
already issued the session by the time it runs. It stamps
`app_metadata.role`, lazy-creates the profile row, and returns an
`onboarded` hint for routing. That hint uses ONE predicate — first + last
name, birthday, sex — mirrored by hand in
`apps/web-consumer/src/lib/consumer-onboarding.ts` and
`apps/mobile-consumer/src/lib/api/auth.ts`. Change one, change all three, or
consumers ping-pong between the app and `/onboard`.

**Consumer OTP wiring.** Supabase Auth's phone provider sends through Twilio
Programmable Messaging, using the Messaging Service attached to
`+16282784122` ("Mesita Verifications (Consumers)" — `integrations/twilio/
numbers.json` is the inventory of record). No Edge Function touches that
number; if it goes dark, nobody can sign in.

**Probing it without sending an SMS**, and without any secret:

```
curl -s https://<ref>.supabase.co/auth/v1/settings -H "apikey: <publishable>"
# → sms_provider, external.phone

curl -s -X POST https://<ref>.supabase.co/auth/v1/otp -H "apikey: <publishable>" \
  -H "Content-Type: application/json" -d '{"phone":"+10000000000"}'
# Twilio 21211 ("'To' not valid") = our credentials authenticate, pipe is live.
# Twilio 20003                    = the credentials are wrong.
```

A 200 on a *valid* number sends a real SMS and creates an unconfirmed
`auth.users` row — delete it after probing.

**What is NOT in this repo.** The hosted project's auth settings — SMS
provider credentials, OTP length, rate limits, captcha — are dashboard-only.
`config.toml`'s `[auth]` block configures the LOCAL stack and is never
pushed (its `site_url` is localhost; `supabase config push` would clobber
production). Work in this area is a human step, not an agent one.

**Known risk.** The sender is a US long code and the market is Mexico, where
carriers filter foreign A2P traffic hard. If delivery to `+52` numbers
fails, the fix is switching the provider to **Twilio Verify** — Supabase
supports it as a distinct provider and it exists for exactly this
routing/compliance problem. Dashboard change only: the client code in both
apps is identical either way.

## Billing

Stripe subscriptions only (no money held). Business membership SKU is
`business_verified_yearly` (MX$1,000/year → `plan=pro`; `ultra` is a legacy
alias). Consumer Premium is the paid class door (`consumer_premium_monthly`).
Webhook: `stripe-webhook-handle-event`. `MOCK_SUBSCRIPTION` (EF env + web
subscribe page constant) gates go-live — human-gated.

## Working conventions (see the Rules quickstart in every CLAUDE.md)

- **Reply in English.** Branch off fresh `main`; never push to `main`; squash-PR.
- **Mirror every Supabase cloud change into the `supabase/` package the same
  session**; after any EF deploy verify cloud == repo (a smoke-test stub once
  clobbered prod).
- Run all `supabase` commands from inside `supabase/` (single migration
  ledger). Prod EF deploys + sensitive DDL are gated.
- **No local WEB dev servers** — verify web apps via Vercel. Mobile: Metro web
  preview (`mobile-consumer` :8081 / `mobile-business` :8082) +
  `npx expo export --platform web`.
- Light theme + semantic tokens across every web app.
- CI: web apps `lint · typecheck · build` (Node 22+); supabase `deno lint · test`.
