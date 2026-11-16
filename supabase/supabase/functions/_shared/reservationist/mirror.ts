// The elevenlabs/ folder at the repo root (MESITA-3972): a generated mirror
// of everything the sync pushes to ElevenLabs, so the agents' exact state is
// readable, diffable and reviewable in the monorepo.
//
// Pato, 2026-11-14: "THE MONOREPO MUST HAVE AN ELEVN LABBS FOLDER ON TOP JUST
// AS ITS HAS FOR RENDER AND SUPABASE ... MIRRORING THE ELEVN LABS STATE".
//
// The source stays here (the sync Edge Function bundles it); `deno task
// sync-elevenlabs` writes mirrorFiles() into elevenlabs/, and mirror.test.ts
// fails CI when the folder drifts from this source. Secrets never appear:
// tools carry placeholders, workflows carry tool names instead of ids.

import {
  agentConversationConfig,
  FLEET,
  fleetWorkflows,
  GUARDRAILS,
  KB_VERSION,
  kbDocName,
  knowledgeFor,
  specHash,
} from "./index.ts";
import { TOOL_NAMES, toolConfigs } from "./tools.ts";
import { FLEET_TESTS, testName } from "./tests.ts";

const DIRECTION: Record<string, string> = {
  a1: "Mesita calls the place",
  a2: "Mesita calls the guest",
  a3: "the guest calls Mesita",
  a4: "the place calls Mesita",
};

const pretty = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** elevenlabs/<path> → file content. */
export async function mirrorFiles(): Promise<Record<string, string>> {
  const toolRef = new Map(TOOL_NAMES.map((n) => [n, `tool:${n}`]));
  const workflows = fleetWorkflows(toolRef);
  const files: Record<string, string> = {};

  files["fleet.json"] = pretty({
    generated: "by `deno task sync-elevenlabs` from supabase/supabase/functions/_shared/reservationist/ — never edit",
    spec_hash: await specHash(),
    knowledge_version: KB_VERSION,
    deploy: ".github/workflows/agents-deploy.yml on every merge to main (supabase/scripts/sync-agents.sh)",
    agents: FLEET.map((a) => ({
      key: a.key,
      name: a.name,
      direction: DIRECTION[a.key] ?? "",
      first_message: a.firstMessage || "(none: waits for the other side to speak)",
      tools: a.toolNames,
      workflow_steps: Object.keys(workflows[a.key].nodes),
      knowledge_doc: kbDocName(a.key),
      tests: FLEET_TESTS.filter((t) => t.agent === a.key).map(testName),
    })),
    tools: TOOL_NAMES,
  });

  for (const a of FLEET) {
    files[`agents/${a.key}.json`] = pretty({
      key: a.key,
      name: a.name,
      direction: DIRECTION[a.key] ?? "",
      conversation_config: agentConversationConfig(a, a.toolNames.map((n) => `tool:${n}`)),
      platform_settings: { guardrails: GUARDRAILS },
      workflow: workflows[a.key],
      knowledge: { name: kbDocName(a.key), text: knowledgeFor(a).split("\n") },
    });
  }

  files["tools.json"] = pretty(toolConfigs("SUPABASE_URL", "ANON_KEY", "TOOL_SECRET"));
  files["tests.json"] = pretty(FLEET_TESTS.map((t) => ({ name: testName(t), ...t })));
  return files;
}
