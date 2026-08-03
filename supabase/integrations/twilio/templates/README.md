# WhatsApp message templates

Source-of-truth JSON files for Twilio Content API. **Do not create templates only in the Console** — Meta approval still happens async, but definitions live here.

Apply:

```bash
./scripts/twilio-apply-templates.sh
```

**Consumer-facing only.** The waiter templates (`staff-invite`, plus the planned
story and bill prompts) went with the waiter identity — staff hold no account,
are never messaged, and work the check page at `check.mesita.ai`. Meta Flows
went with them: in-chat forms only ever existed for staff onboarding.

No definitions exist yet. Candidates:

| Template | Use |
|---|---|
| `reservation-confirmed` | Consumer booking confirmation |
| `reservation-reminder` | Day-of reminder |

See [docs/whatsapp.md](../../docs/whatsapp.md) for WABA IDs and webhook URLs.
