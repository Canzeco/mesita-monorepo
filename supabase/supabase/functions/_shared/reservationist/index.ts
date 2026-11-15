// The reservation agents, config-as-code.
//
//   a1 (es-mx) · outbound to places   books, moves or cancels a table
//   a2 (es-mx) · outbound to guests   what the place said, reminders
//   a3 (es-mx) · inbound              anyone calling Mesita's one number:
//                                     the caller id says place, guest or
//                                     both, and the workflow branches
//   (a4, the places' inbound agent, merged into a3: MESITA-3974)
//
// One file per thing: facts.ts (what every agent knows), closing.ts (how to
// hang up), settings.ts (voice, LLM, ASR, turn), tools.ts (the webhook
// tools), graph.ts (workflow blocks), a1..a3.ts (each agent whole).
//
// supabase-edgefunc-sync-reservationist makes ElevenLabs match this on every
// run: mode "fleet" pushes prompt, first message, settings and tools and
// stores each agent's hash; "knowledge" pushes knowledgeFor(agent) as the
// agent's one doc; "workflows" pushes each graph.

import { A1 } from "./a1.ts";
import { A2 } from "./a2.ts";
import { A3 } from "./a3.ts";
import { FACTS } from "./facts.ts";
import type { FleetAgent, FleetAgentKey, FleetWorkflow } from "./graph.ts";
import { ASR, BUILT_IN_TOOLS, CONVERSATION, LANGUAGE, LANGUAGE_PRESETS, LLM, TTS, TURN, TURN_OUTBOUND } from "./settings.ts";
import type { ToolName } from "./tools.ts";

export type { FleetAgent, FleetAgentKey, FleetWorkflow } from "./graph.ts";
export { TOOL_NAMES, toolConfigs, type ToolName } from "./tools.ts";
import { TOOL_NAMES, toolConfigs } from "./tools.ts";
import { FLEET_TESTS } from "./tests.ts";

export const FLEET: FleetAgent[] = [A1, A2, A3];

/** Knowledge content version — rides in every doc name (a1-kb-v9 …). */
export const KB_VERSION = 10;

export function kbDocName(key: FleetAgentKey): string {
  return `${key}-kb-v${KB_VERSION}`;
}

/** An agent's knowledge doc: the shared facts, then its own role. */
export function knowledgeFor(agent: FleetAgent): string {
  return [FACTS, "", ...agent.roleLines].join("\n");
}

/** Every agent's graph, with tool nodes wired to the live workspace ids. */
export function fleetWorkflows(toolIdByName: Map<string, string>): Record<FleetAgentKey, FleetWorkflow> {
  const tool = (name: ToolName) => {
    const id = toolIdByName.get(name);
    if (!id) throw new Error(`workspace missing tool ${name}`);
    return id;
  };
  return Object.fromEntries(FLEET.map((a) => [a.key, a.workflow(tool)])) as Record<
    FleetAgentKey,
    FleetWorkflow
  >;
}

/** The agent section + settings the fleet sync writes (create and update). */
export function agentConversationConfig(agent: FleetAgent, toolIds: string[]): Record<string, unknown> {
  return {
    agent: {
      first_message: agent.firstMessage,
      language: LANGUAGE,
      prompt: { ...LLM, prompt: agent.prompt, tool_ids: toolIds, built_in_tools: BUILT_IN_TOOLS },
    },
    tts: TTS,
    asr: ASR,
    // No first message = a call Mesita places: wait for the other side first.
    turn: agent.firstMessage === "" ? TURN_OUTBOUND : TURN,
    conversation: CONVERSATION,
    language_presets: LANGUAGE_PRESETS,
  };
}

/**
 * sha256 of what an agent says: prompt + first message. The sync stores the
 * repo's hash in agents_config.agents.<key>.hash and inspect recomputes it
 * from the live agent, so a console edit shows up as drift.
 */
export async function agentHash(prompt: string, firstMessage: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ prompt, firstMessage }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One hash over everything the sync pushes (MESITA-3968): prompts, first
 * messages, settings, tools (with placeholder secrets), knowledge, workflows
 * and tests. The sync's mode "version" answers it from the DEPLOYED code;
 * GitHub (agents-deploy.yml) computes it from main and waits until they are
 * equal before syncing, so it never pushes the previous deploy's agents.
 */
export async function specHash(): Promise<string> {
  const toolIds = new Map(TOOL_NAMES.map((n) => [n, `tool:${n}`]));
  const spec = {
    kb: KB_VERSION,
    agents: FLEET.map((a) => ({
      key: a.key,
      name: a.name,
      config: agentConversationConfig(a, a.toolNames.map((n) => `tool:${n}`)),
      knowledge: knowledgeFor(a),
    })),
    workflows: fleetWorkflows(toolIds),
    tools: toolConfigs("SUPABASE_URL", "ANON_KEY", "TOOL_SECRET"),
    tests: FLEET_TESTS,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
