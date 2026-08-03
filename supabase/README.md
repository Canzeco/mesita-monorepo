# supabase — Mesita backend

**Mesita backend** — Supabase (Postgres, Auth, Edge Functions) plus third-party integrations (Twilio, Stripe, ElevenLabs). Web and mobile apps call Edge Functions only; functions own business logic and talk to the database.

- **Project ref:** `yjalywfzdelacdzccpgb`
- **Dashboard:** https://supabase.com/dashboard/project/yjalywfzdelacdzccpgb

---

## Architectural rules

1. **Clients never touch the database.** Edge Functions are the only write path (service role inside EFs).
2. **Edge Functions do not call each other.** Each function owns an end-to-end workflow.
3. **Integration config lives in git** (`integrations/`) and is applied with `scripts/` — not ad-hoc Console clicks.
4. **Workflow logic lives in Edge Functions**, not in Twilio Studio or ElevenLabs prompts alone (except reservation voice agent, post-MVP).

---

## Repository layout

```
mesita-supabase/
├── README.md                 # you are here
├── integrations/             # declarative config (git = source of truth)
│   ├── twilio/
│   │   ├── numbers.json      # the number inventory — owner + releasable
│   │   └── twiml/            # voice TwiML (recording, etc.)
│   └── elevenlabs/           # the Reservationist fleet (a1–a4)
├── scripts/
│   ├── deploy.sh             # db push + regen types for web repos
│   └── setup-twilio-call-recording.sh
├── supabase/
│   ├── config.toml           # CLI config, per-function JWT flags
│   ├── functions/            # Edge Functions (runtime)
│   ├── migrations/
│   └── seed.sql
└── .env.twilio.local.example # local Twilio scripts only (gitignored)
```

### Runtime vs config

| Layer | Location | Deploy |
|---|---|---|
| **App logic** (tickets, reservations, auth) | `supabase/functions/` | `supabase functions deploy` |
| **Stripe** | `stripe-webhook-handle-event` | same |
| **Twilio numbers, TwiML** | `integrations/twilio/` + `scripts/` | run scripts locally |
| **ElevenLabs agents** (later) | `integrations/elevenlabs/` | API scripts + Supabase webhook EF |

---

## External integrations

### Twilio (SMS + voice)

**Two rails on one account. No WhatsApp** — Mesita neither sends nor receives it
(retired 2026-08-03); there is no `Messages.json` call anywhere in the codebase and
no Twilio webhook reaches an Edge Function.

1. **SMS — phone OTP.** Supabase Auth sends it directly via `TWILIO_MESSAGE_SERVICE_SID`
   ([config.toml](supabase/config.toml) `[auth.sms.twilio]`). This is the ONLY consumer
   sign-in there is; no Edge Function is in the path.
2. **Voice — the Reservationist.** Two ElevenLabs-owned lines, one per audience: a
   venue-facing line (a1 dials out, a4 answers) and a guest-facing line (a2 dials out,
   a3 answers). An ElevenLabs number binds to ONE inbound agent, which is why they
   cannot share. Their Twilio webhooks point at ElevenLabs — never overwrite them.

**The number inventory is [`integrations/twilio/numbers.json`](integrations/twilio/numbers.json)**,
not this file: each entry carries its owner and whether it may be released. Read it
before releasing anything — the sign-in number is one careless click from a lockout,
and Twilio does not give a number back.

**Secrets (Supabase):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`TWILIO_MESSAGE_SERVICE_SID` are read by Supabase Auth (`config.toml`) and the local
scripts — no Edge Function reads them. Stripping any of the three breaks sign-in.

**Local scripts** — copy [`.env.twilio.local.example`](.env.twilio.local.example) → `.env.twilio.local`, then sync into project-root `.env` (Supabase CLI reads it for `config.toml`):

```bash
./scripts/sync-root-env.sh                    # .env.twilio.local → .env (run after edits)
./scripts/setup-twilio-call-recording.sh      # voice → record-incoming TwiML
```

`./scripts/deploy.sh` runs `sync-root-env.sh` automatically.

### Stripe

Webhook: `stripe-webhook-handle-event` (public, signature-verified). Membership / Premium door.

### ElevenLabs (post-MVP)

AI voice for **phone reservations** on its own **two** Twilio lines (venue-facing + guest-facing). See [integrations/elevenlabs/README.md](integrations/elevenlabs/README.md).

---

## Edge Function families

| Prefix | Auth | Purpose |
|---|---|---|
| `admin-*` | email + MFA | Super-admin console |
| `business-web-*` | email | Places, tickets, team, verification |
| `consumer-*` | phone OTP | Discovery, tickets, **reservations**, profile |
| `check-web-*` | none (`check_code` possession) | Public check page — the whole staff surface |
| `stripe-webhook-handle-event` | Stripe signature | Subscriptions |
| `supabase-cron-*` | internal (pg_cron poller) | Scheduled creates + the Enricher pipeline |
| `enricher-agent-*` | internal | Place persistence services (service role) |

**The Enricher is a process, not an agent:** a cron-driven pipeline of three
Edge Functions (`supabase-cron-enrich-place-{research,analysis,contents}`)
advancing places through the `place_research` stage table
(research → analysis → contents → done). Create EFs seed the row; the pg_cron
poller `run_place_enrichment_stages` drives the stages. n8n is fully out of
the stack (the Reservationist will be ElevenLabs-based).

Reward ticket sequences (create, scan, billing, story, payment, review) are documented in [docs/TICKET_SEQUENCES.md](docs/TICKET_SEQUENCES.md). Tickets v2 (MESITA-806): the CONSUMER creates the ticket (`consumer-web-create-ticket`); staff work it on the public check page `mesita.ai/check/<code>` (`check-web-*`, `verify_jwt=false`), with the business console as the only secondary rail. Consumer step order lives in each app's `ticket-flow-steps.ts`.

---

## Common commands

```bash
# One-time link
supabase link --project-ref yjalywfzdelacdzccpgb

# Schema
supabase db push

# Migrations + regen TS types for web repos
./scripts/deploy.sh

# Deploy changed functions
supabase functions deploy <name> [<name> ...]

# Run the Edge Function test suite (billing math + money-path contract smoke
# tests). Offline: no DB, no live Stripe. Also runs in CI on every PR.
deno task test
```

---

## Schema highlights

- **`places`** — catalog (`lead | active | paused | archived`)
- **`project_members`** — business team access (owner / editor / viewer)
- **`tickets`** — reward tickets (discount × story/no-story)
- **`reservations`** — consumer bookings (MVP)
- **`business_invites`** — token invites (business team only; there is no waiter invite)

RLS: clients read only what they may see; writes go through Edge Functions.

---

## MVP checklist (communications)

- [ ] `supabase secrets set` Twilio vars
- [ ] Buy + import the guest-facing reservation line, bind inbound to a3
- [ ] Set `ELEVENLABS_CONSUMER_FROM_NUMBER`
- [ ] Release the two retired WhatsApp numbers (see `integrations/twilio/numbers.json`)

---

## Related repos

| Repo | Role |
|---|---|
| `mesita-web-consumer` | Diner app |
| `mesita-web-business` | Place dashboard |
| `mesita-web-admin` | Internal admin |
| **mesita-supabase** | **Backend + integrations** |

No separate `mesita-twilio` or `mesita-elevenlabs` repos — config and runtime stay here.
