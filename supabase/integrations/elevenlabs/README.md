# ElevenLabs — the Reservationist fleet (ElevenAgents platform)

Mesita's reservation agents run on **ElevenAgents** (not ElevenCreative/ElevenAPI).

**Managed AS CODE from this repo** since 2026-07-27 (supersedes the 2026-07-20
console-only decision): `supabase-edgefunc-sync-reservationist` makes the live
workspace match the repo spec over the ElevenLabs management API — the key never
leaves EF env. Prompts stay console-tunable after creation (see `write_prompts`
below); every other page (Tools, Workflow, Knowledge Base) is repo-owned.

## The fleet (a1–a4)

| Key | Agent | Direction |
| --- | --- | --- |
| a1 | `eleven-a1 (es-mx) · c2b outbound booker` | calls the place for the guest |
| a2 | `eleven-a2 (es-mx) · b2c outbound confirmer` | calls the guest back |
| a3 | `eleven-a3 (es-mx) · consumer inbound` | guest phones Mesita (support) |
| a4 | `eleven-a4 (es-mx) · business inbound` | place phones Mesita (support) |

Live agent ids, `toolSecret`, and KB doc ids live in
`app_settings.agents_config` (`agents.a1..a4`, `knowledgeDocIds`) — the call
engine and the webhook-tool EFs read them from there.

## Config-as-code surfaces

- `functions/_shared/reservationist-fleet.ts` — agent specs (names, prompts,
  first messages), the 9 workspace webhook tools (the 8 family tools
  `a1_report_outcome` … `a4_cancel_reservation` → `eleven-a*-*` EFs, plus the
  transitional `get_reservation` → `eleven-agent-get-reservation`, attached to
  a3/a4 for reference-code lookups; anon bearer + `x-agent-secret`), and the
  four Workflow graphs (exactly one per agent — v2 complex graphs: a1
  gatekeeper + per-outcome reporting, a2 context routing + voicemail leg,
  a3/a4 triage with cancel confirmation and code-lookup lanes).
- `functions/_shared/reservationist-kb.ts` — the curated Mesita brief. Each
  agent carries EXACTLY ONE KB doc named `<key>-kb-v<version>` (`a1-kb-v1` …),
  attached `usage_mode=prompt`. Bump `RESERVATIONIST_KB_VERSION` on material
  text changes; the sync renames docs in place.
- `functions/_shared/elevenlabs.ts` — runtime contract: key env
  (`ELEVENLABS_KEY`, alias `ELEVEN_KEY`), default agent (a1), outbound line
  **+1 628 296 0710** (`ELEVENLABS_FROM_NUMBER` override), outbound-call and
  conversation-status helpers, per-call override gate
  (`ELEVENLABS_ALLOW_OVERRIDES`, default OFF — see MESITA-757 note in code).

## Running a sync (operator path)

The sync EF is an internal caller (`verify_jwt` + service-role): invoke via
pg_net with the vault `scheduler_service_role_key`, body `{ "mode": … }`.

- `inspect` — read-only report: agents, tools, per-agent workflow + KB state.
- `fleet` — upsert the 9 tools + 4 agents; PATCHes name + `tool_ids` onto Main;
  prompts/first messages only with `write_prompts: true`.
- `workflows` — commit each agent's Workflow graph onto its Main branch.
- `knowledge` — upsert `a1-kb-v1` … `a4-kb-v1` and attach each as its agent's
  SOLE KB doc; deletes the pre-fleet shared doc once detached.
- `prune` — delete non-fleet agents (never touches fleet tools).

Per-call dynamic variables ride from `_shared/reservation-legs.ts`
(place/guest/date/time/party, `reference_code`, `call_context`,
`venue_alternatives`, …); inbound identity is bound to `system__caller_id`.
**Renaming an agent, a variable, or the number on one side breaks the other —
change repo and workspace in the same session.**

## Auth + Twilio prerequisites

- EF secret `ELEVEN_KEY` (accepted alias of `ELEVENLABS_KEY`) — runtime.
- MCP connector key (`CLAUDE_ELEVEN_KEY`) — agent editing from Claude.
  Both account-level, scoped ElevenAgents=Write (elevenlabs.io → Developers →
  API Keys).
- Twilio **voice geo-permissions must allow Mexico** (low-risk) or every +52
  dial fails at 0s with a "failed" conversation and no Twilio call record.
- **Two lines, one per audience** — an imported number binds to exactly ONE
  inbound agent, so a3 (guests) and a4 (places) cannot share one. The
  place-facing line is `ELEVENLABS_FROM_NUMBER` (default `+1 628 296 0710`,
  inbound → a4); the guest-facing line is `ELEVENLABS_CONSUMER_FROM_NUMBER`
  (inbound → a3), and it falls back to the place line until set. Outbound
  pairs the same way: a1 dials places from the place line, a2 dials guests
  from the guest line, so each side saves a different caller ID and a callback
  routes on the dialed number.
- **Only import numbers marked `owner: elevenlabs`** in
  `../twilio/numbers.json`. The sign-in number is a Messaging Service owned by
  Supabase Auth — importing it would break phone OTP.
