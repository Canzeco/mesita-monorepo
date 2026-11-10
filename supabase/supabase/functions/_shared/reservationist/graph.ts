// The agent shape and the workflow building blocks the four agent files share.
//
// OpenAPI: AgentWorkflowRequestModel { nodes, edges, prevent_subagent_loops }.
// Procedures are Alpha and unused; workflows only.

import type { ToolId, ToolName } from "./tools.ts";

export type FleetAgentKey = "a1" | "a2" | "a3" | "a4";

/** One agent, whole: everything ElevenLabs holds for it comes from here. */
export type FleetAgent = {
  key: FleetAgentKey;
  /** Console display name — carries the language tag. */
  name: string;
  firstMessage: string;
  /** Short identity prompt. Branch logic lives ONLY in the workflow nodes. */
  prompt: string;
  /** Webhook tools attached to the agent (the workflow's tool nodes use them). */
  toolNames: ToolName[];
  /** What this agent does, appended to FACTS in its knowledge doc. */
  roleLines: string[];
  workflow: (tool: ToolId) => FleetWorkflow;
};

export type FleetWorkflow = {
  nodes: Record<string, Record<string, unknown>>;
  edges: Record<string, Record<string, unknown>>;
  prevent_subagent_loops: boolean;
};

export function pos(x: number, y: number) {
  return { x, y };
}

export function edge(
  source: string,
  target: string,
  forward: Record<string, unknown>,
  backward?: Record<string, unknown>,
) {
  const e: Record<string, unknown> = { source, target, forward_condition: forward };
  if (backward) e.backward_condition = backward;
  return e;
}

export const UNCOND = { type: "unconditional" as const };
export const RESULT_OK = { type: "result" as const, successful: true, label: "success" };
/** On an edge into a tool node: if the webhook fails, return and try again. */
export const RESULT_FAIL = { type: "result" as const, successful: false, label: "failure" };

/** Unconditional backward condition — lets the flow return along the edge. */
export function back(label: string) {
  return { type: "unconditional" as const, label };
}

export function llm(condition: string, label: string) {
  return { type: "llm" as const, condition, label };
}

export const START = (firstEdge: string) => ({
  type: "start",
  position: pos(0, 0),
  edge_order: [firstEdge],
});

export const END = (x: number) => ({ type: "end", position: pos(x, 0), edge_order: [] });

/**
 * A conversation step. It carries no webhook tools: tools fire only from
 * dedicated tool nodes, so the graph (not the LLM) decides when they run.
 *
 * Lesson kept from live calls (conv_1201kz2cg6…, 2026-08-02): every talk→talk
 * hop can cut the agent off mid-sentence, so a phase that is one human speech
 * act stays one node.
 */
export function talkNode(opts: {
  label: string;
  position: { x: number; y: number };
  prompt: string;
  edgeOrder: string[];
}): Record<string, unknown> {
  return {
    type: "override_agent",
    label: opts.label,
    position: opts.position,
    additional_prompt: opts.prompt,
    entry_behavior: "generate_immediately",
    conversation_config: { agent: { prompt: { tool_ids: [] } } },
    edge_order: opts.edgeOrder,
  };
}

export function toolNode(
  toolId: string,
  position: { x: number; y: number },
  edgeOrder: string[],
): Record<string, unknown> {
  return { type: "tool", position, tools: [{ tool_id: toolId }], edge_order: edgeOrder };
}
