// The reservation agents, config-as-code.
//
//   a1 (es-mx) · outbound to places   books, moves or cancels a table
//   a2 (es-mx) · outbound to guests   what the place said, reminders
//   a3 (es-mx) · inbound from guests  their reservations, cancel
//   a4 (es-mx) · inbound from places  their book, find by name, cancel
//
// One file per thing: facts.ts (what every agent knows), closing.ts (how to
// hang up), settings.ts (voice, LLM, ASR, turn), tools.ts (the nine webhook
// tools), graph.ts (workflow blocks), a1..a4.ts (each agent whole).
//
// supabase-edgefunc-sync-reservationist makes ElevenLabs match this on every
// run: mode "fleet" pushes prompt, first message, settings and tools and
// stores each agent's hash; "knowledge" pushes knowledgeFor(agent) as the
// agent's one doc; "workflows" pushes each graph.

import { A1 } from "./a1.ts";
import { A2 } from "./a2.ts";
import { A3 } from "./a3.ts";
import { A4 } from "./a4.ts";
import { FACTS } from "./facts.ts";
import type { FleetAgent, FleetAgentKey, FleetWorkflow } from "./graph.ts";
import { ASR, BUILT_IN_TOOLS, CONVERSATION, LANGUAGE, LLM, TTS, TURN } from "./settings.ts";
import type { ToolName } from "./tools.ts";

export type { FleetAgent, FleetAgentKey, FleetWorkflow } from "./graph.ts";
export { TOOL_NAMES, toolConfigs, type ToolName } from "./tools.ts";

export const FLEET: FleetAgent[] = [A1, A2, A3, A4];

/** Knowledge content version — rides in every doc name (a1-kb-v6 …). */
export const KB_VERSION = 6;

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
    turn: TURN,
    conversation: CONVERSATION,
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
