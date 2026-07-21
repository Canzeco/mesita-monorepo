# ElevenLabs — the Reservationist (ElevenAgents platform)

Mesita's reservation agents run on **ElevenAgents** (not ElevenCreative/ElevenAPI).

**Managed DIRECTLY in the ElevenLabs console/MCP — deliberately NOT synced from
this repo** (decision 2026-07-20: agent config is one prompt + a few knobs;
treat it like Twilio, a managed external service). Edit prompts/voices live.

## Agents

| Agent | Direction | Status |
| --- | --- | --- |
| `Reservationist to Business (Spanish MX)` — `agent_2201kxsktw0me9rb2kdtqerrgzha` | consumer→business: phones the venue, books the table | live |
| `Reservationist to Consumer (Spanish MX)` | business→consumer: phones the guest to confirm | future |

Naming: `<Role> to <Audience> (<Language> <Region>)`.

## The repo-side contract (the ONLY thing code depends on)

Lives in `functions/_shared/elevenlabs.ts`:

- Agent id (`DEFAULT_AGENT_ID`; env override `ELEVENLABS_AGENT_ID`).
- Outbound line **+1 628 296 0710** ("Mesita Reservations (Businesses)"),
  imported from Twilio into ElevenAgents (`phnum_4601ky3bkj6yfnnaz756d18cakt2`);
  env override `ELEVENLABS_FROM_NUMBER`.
- Dynamic-variable names injected per call: `venue_name`, `guest_name`,
  `party_size`, `reservation_date`, `reservation_time`, `occasion`,
  `special_requests`.

**Rule: renaming a variable, the agent, or the number in the console breaks the
EFs — change both sides in the same session.**

**Do not import the WhatsApp numbers (`…4968`, `…8794`) into ElevenLabs** — they
are owned by Supabase webhooks.

## Auth + Twilio prerequisites

- EF secret `ELEVEN_KEY` (accepted alias of `ELEVENLABS_KEY`) — runtime.
- MCP connector key (`CLAUDE_ELEVEN_KEY`) — agent editing from Claude.
  Both account-level, scoped ElevenAgents=Write (elevenlabs.io → Developers →
  API Keys).
- Twilio **voice geo-permissions must allow Mexico** (low-risk) or every +52
  dial fails at 0s with a "failed" conversation and no Twilio call record.
