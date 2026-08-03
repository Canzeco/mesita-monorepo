# WhatsApp (Twilio) — runbook

Operational detail for Mesita WhatsApp. Architecture overview: [README.md](../README.md).

> **Outbound to consumers only.** There is no staff WhatsApp and no inbound rail:
> staff work the check page (`check.mesita.ai`), hold no account, and are never
> messaged. Don't re-add an inbound handler, a waiter invite template or a Meta
> Flow — all three existed only to give a waiter an identity.

## IDs

| | ID |
|---|---|
| Meta Business Portfolio (Mesita) | `1180640363250622` |
| WABA | `1389123139178386` |
| Consumer sender | `+1 628 296 4968` — Mesita Notifications |
| Recording TwiML bin | `EHfd33bff85448c2a934494625fb70d808` |

The old staff sender `+1 628 296 8794` (Mesita Ops) is unused by any code. Releasing it is
a console-only chore — see the cleanup note at the bottom.

## Webhook URLs (prod)

Base: `https://yjalywfzdelacdzccpgb.supabase.co/functions/v1`

| Endpoint | Function |
|---|---|
| `/twilio-webhook-update-delivery` | Delivery receipts |

Apply via `./scripts/sync-twilio-whatsapp-webhooks.sh` or Twilio Console → WhatsApp Senders.

## Secrets

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=AC... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_WHATSAPP_FROM_CONSUMERS='whatsapp:+16282964968'
```

Local scripts: `.env.twilio.local` (see `.env.twilio.local.example`).

`TWILIO_WHATSAPP_FROM_STAFF` and `TWILIO_CONTENT_SID_STAFF_INVITE` are gone from the code
entirely. If they are still set in Supabase secrets, unset them (below).

## Billing

WhatsApp message fees go through **Twilio** (Twilio fee + Meta pass-through on the same invoice). No separate Meta invoice for traffic via Twilio.

## Meta (manual)

- [Business Verification](https://business.facebook.com/latest/settings/security_center?business_id=1180640363250622)
- OBA (green ✓): optional, WhatsApp Manager per number

## Pending cleanup (console-only, needs a human)

Not done in code because they are external and irreversible:

- Release/repark the Mesita Ops sender `+1 628 296 8794`.
- Delete the `staff-invite` content template in Twilio Console → Content.
- Unset `TWILIO_WHATSAPP_FROM_STAFF` / `TWILIO_CONTENT_SID_STAFF_INVITE` in Supabase secrets.
