# WhatsApp (Twilio) — runbook

Operational detail for Mesita WhatsApp. Architecture overview: [README.md](../README.md).

> **Staff WhatsApp is gone (MESITA-833).** The waiter identity was retired — staff work
> the public check page (`mesita.ai/check/<code>`), hold no account, and are never
> messaged. The inbound handler (`business-whats-handle-message`), the waiter invite and
> the Type A conversational flow were deleted with it. What remains below is
> **outbound-only**: consumer notifications and delivery receipts.

## IDs

| | ID |
|---|---|
| Meta Business Portfolio (Mesita) | `1180640363250622` |
| WABA | `1389123139178386` |
| Consumer sender | `+1 628 296 4968` — Mesita Notifications |
| Recording TwiML bin | `EHfd33bff85448c2a934494625fb70d808` |

The staff sender `+1 628 296 8794` (Mesita Ops) no longer has an inbound handler. Retiring
the number and its `staff-invite` content template is a console-only chore — see the
cleanup note at the bottom.

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

`TWILIO_WHATSAPP_FROM_STAFF` and `TWILIO_CONTENT_SID_STAFF_INVITE` are dead — nothing
reads them since the waiter retirement.

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
