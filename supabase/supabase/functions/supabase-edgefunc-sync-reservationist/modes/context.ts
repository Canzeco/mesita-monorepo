// supabase-edgefunc-sync-reservationist · what each mode is handed.
//
// Three stages, each a superset of the last, loaded by index.ts only as far
// as the mode needs (a read-only `calls` never touches app_config):
//   BaseCtx       the ElevenLabs key and the request body.
//   WorkspaceCtx  + agents_config (toolSecret checked) and the live workspace
//                 tools and agents.
//   DonorCtx      + the donor agent (a1) and its prompt shape.

import type { EFEnv } from "../../_shared/auth.ts";
import type { AgentShape, PromptShape, ToolRow } from "../el-client.ts";

export const MODE_NAMES = [
  "inspect",
  "fleet",
  "prune",
  "workflows",
  "knowledge",
  "calls",
  "transcript",
  "phones",
] as const;
export type Mode = typeof MODE_NAMES[number];

export type ModeBody = {
  mode?: unknown;
  write_prompts?: unknown;
  conversation_id?: unknown;
  limit?: unknown;
};

export type BaseCtx = {
  key: string;
  mode: Mode;
  body: ModeBody;
  env: EFEnv;
};

export type ConfiguredAgents = Record<string, { id?: string; name?: string } | undefined>;

export type WorkspaceCtx = BaseCtx & {
  agentsConfig: Record<string, unknown>;
  toolSecret: string;
  configuredAgents: ConfiguredAgents;
  toolRows: ToolRow[];
  toolIdByName: Map<string, string>;
  listedAgents: Array<{ agent_id?: string; name?: string }>;
  /** Writes app_config.agents_config (the whole object). */
  saveAgentsConfig: (next: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

export type DonorCtx = WorkspaceCtx & {
  donorId: string;
  donor: AgentShape;
  donorCc: NonNullable<AgentShape["conversation_config"]>;
  donorPrompt: PromptShape;
  promptCharsBefore: number;
  toolIdsBefore: string[];
};

/** "2 of 4 agents failed verification", or null when every row read back ok.
 *  A partial failure is a 502: the operator must not read it as done. */
export function failedVerification(rows: Array<Record<string, unknown>>): string | null {
  const failed = rows.filter((r) => r.ok !== true).length;
  return failed > 0 ? `${failed} of ${rows.length} agents failed verification` : null;
}
