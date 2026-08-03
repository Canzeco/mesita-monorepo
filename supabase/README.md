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
├── docs/
│   └── whatsapp.md           # Twilio/Meta IDs, webhook URLs, runbook
├── integrations/             # declarative config (git = source of truth)
│   ├── twilio/
│   │   ├── twiml/            # voice TwiML (recording, etc.)
│   │   └── templates/        # WhatsApp Content API template definitions
│   └── elevenlabs/           # reservation voice agents (post-MVP)
├── scripts/
│   ├── deploy.sh             # db push + regen types for web repos
│   ├── setup-twilio-call-recording.sh
│   └── sync-twilio-whatsapp-webhooks.sh
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
| **Twilio WhatsApp / SMS** | `_shared/twilio.ts` + `twilio-webhook-update-delivery` | same |
| **Stripe** | `stripe-webhook-handle-event` | same |
| **Twilio templates, TwiML, webhooks** | `integrations/twilio/` + `scripts/` | run scripts locally |
| **ElevenLabs agents** (later) | `integrations/elevenlabs/` | API scripts + Supabase webhook EF |

---

## External integrations

### Twilio (WhatsApp, SMS, voice)

**Role: three independent rails on one Twilio account.** They share only
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — changing one never touches the others.

1. **SMS — phone OTP.** Supabase Auth sends it directly via `TWILIO_MESSAGE_SERVICE_SID`
   ([config.toml](supabase/config.toml) `[auth.sms.twilio]`). This is the ONLY consumer
   sign-in there is; no Edge Function is in the path.
2. **Voice — incoming-call recording.** `integrations/twilio/twiml/record-incoming.xml`
   on bin `EHfd33...`, applied by `./scripts/setup-twilio-call-recording.sh`. (Reservation
   voice is ElevenLabs on its own dedicated number — see below.)
3. **WhatsApp — outbound to consumers only.** Notifications + delivery receipts. No
   inbound handler: staff WhatsApp went with the waiter identity (MESITA-833), and staff
   now work the check page instead.

The scope note in (3) is about WhatsApp alone. Retiring WhatsApp pieces must never strip
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGE_SERVICE_SID` — that would
break sign-in and call recording.

| Number | Label | Use |
|---|---|---|
| `+1 628 296 4968` | Mesita Notifications | Consumer notifications |

Meta WABA `1389123139178386` · Portfolio `1180640363250622`. Details: [docs/whatsapp.md](docs/whatsapp.md).

**Secrets (Supabase):**

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=AC... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_WHATSAPP_FROM_CONSUMERS='whatsapp:+16282964968'
```

`TWILIO_MESSAGE_SERVICE_SID` is also used by Supabase Auth SMS ([config.toml](supabase/config.toml)).

**Local scripts** — copy [`.env.twilio.local.example`](.env.twilio.local.example) → `.env.twilio.local`, then sync into project-root `.env` (Supabase CLI reads it for `config.toml`):

```bash
./scripts/sync-root-env.sh                    # .env.twilio.local → .env (run after edits)
./scripts/setup-twilio-call-recording.sh      # voice → record-incoming TwiML
./scripts/sync-twilio-whatsapp-webhooks.sh    # WA senders → Supabase EFs
```

`./scripts/deploy.sh` runs `sync-root-env.sh` automatically.

**Deploy webhooks:**

```bash
supabase functions deploy twilio-webhook-update-delivery
```

### Stripe

Webhook: `stripe-webhook-handle-event` (public, signature-verified). Membership / Premium door.

### ElevenLabs (post-MVP)

AI voice for **phone reservations** on a **dedicated** Twilio number — not the WhatsApp lines. See [integrations/elevenlabs/README.md](integrations/elevenlabs/README.md).

---

## Edge Function families

| Prefix | Auth | Purpose |
|---|---|---|
| `admin-*` | email + MFA | Super-admin console |
| `business-web-*` | email | Places, tickets, team, verification |
| `consumer-*` | phone OTP | Discovery, tickets, **reservations**, profile |
| `check-web-*` | none (`check_code` possession) | Public check page — the whole staff surface |
| `twilio-webhook-update-delivery` | Twilio signature | Delivery status |
| `stripe-webhook-handle-event` | Stripe signature | Subscriptions |
| `supabase-cron-*` | internal (pg_cron poller) | Scheduled creates + the Enricher pipeline |
| `enricher-agent-*` | internal | Place persistence services (service role) |

**The Enricher is a process, not an agent:** a cron-driven pipeline of three
Edge Functions (`supabase-cron-enrich-place-{research,analysis,contents}`)
advancing places through the `place_research` stage table
(research → analysis → contents → done). Create EFs seed the row; the pg_cron
poller `run_place_enrichment_stages` drives the stages. n8n is fully out of
the stack (the Reservationist will be ElevenLabs-based).

Reward ticket sequences (create, scan, billing, story, payment, review) are documented in [docs/TICKET_SEQUENCES.md](docs/TICKET_SEQUENCES.md). Tickets v2 (MESITA-806): the CONSUMER creates the ticket (`consumer-web-create-ticket`); staff work it on the public check page `mesita.ai/check/<code>` (`check-web-*`, `verify_jwt=false`), with the business console as the only secondary rail; Twilio sends the consumer messages. Consumer step order lives in each app's `ticket-flow-steps.ts`.

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

- [x] WABA + WhatsApp senders connected
- [ ] Meta Business Verification
- [ ] `supabase secrets set` Twilio vars
- [ ] Deploy `twilio-webhook-update-delivery`
- [ ] `./scripts/sync-twilio-whatsapp-webhooks.sh`
- [ ] WhatsApp templates in `integrations/twilio/templates/` + apply script
- [ ] Wire reservation confirmations
- [ ] Reservation voice (ElevenLabs) — post-MVP, separate number

---

## Related repos

| Repo | Role |
|---|---|
| `mesita-web-consumer` | Diner app |
| `mesita-web-business` | Place dashboard |
| `mesita-web-admin` | Internal admin |
| **mesita-supabase** | **Backend + integrations** |

No separate `mesita-twilio` or `mesita-elevenlabs` repos — config and runtime stay here.
