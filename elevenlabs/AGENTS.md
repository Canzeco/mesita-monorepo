<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# elevenlabs — the reservation agents (ElevenLabs)

> Read root [`CLAUDE.md`](../CLAUDE.md) first. Package law only. Notion Docs: Reservations.

- **This folder is generated; never hand-edit it.** It mirrors exactly what Mesita pushes to ElevenLabs: `fleet.json` (the three agents, their tools, workflow steps and tests at a glance), `agents/a1.json`…`a3.json` (each agent whole: settings, prompt, first message, workflow, knowledge), `tools.json`, `tests.json`. The source is `supabase/supabase/functions/_shared/reservationist/`; `deno task sync-elevenlabs` rewrites this folder, and `supabase/supabase/functions/_shared/reservationist/mirror.test.ts` fails CI when it drifts.
- **Change an agent:** edit the source, run `deno task sync-elevenlabs`, open the PR. The diff of this folder is the review.
- **Deploy is the merge:** `.github/workflows/agents-deploy.yml` waits for Supabase, pushes the agents, reads them back. Never edit in the ElevenLabs console: the next deploy overwrites it.
- **Every behaviour that must hold gets a simulated caller** in `tests.ts`; a failed test is a defect, not a quirk.
- **Simulated calls cost ElevenLabs credits.** A deploy runs only calls named by `Agent-tests: <label>` commit lines, one at a time, stopping at the first failure. Re-run one: `deno task agent-test "<label>"`. Never the whole suite by habit.
