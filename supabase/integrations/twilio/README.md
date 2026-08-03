# Twilio integration

Git-managed Twilio config for Mesita. Runtime sends/receives via Supabase Edge Functions.

| Path | Purpose |
|---|---|
| `numbers.json` | The number inventory — owner, purpose, releasable. Read before releasing anything. |
| `twiml/record-incoming.xml` | Incoming call recording (bin `EHfd33...`) |

**Scripts:** `../../scripts/setup-twilio-call-recording.sh` (targets come from `numbers.json`)

Twilio serves two rails here — SMS phone-OTP (sent by Supabase Auth itself) and the
Reservationist's two voice lines (owned by ElevenLabs). **No WhatsApp**, and no Twilio
webhook reaches an Edge Function.

**Overview:** [README.md](../../README.md)
