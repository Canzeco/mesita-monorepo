// Memo knobs: app_config.memo_config (MESITA-1248).
//
// Folds the six leftover memo_* scalar columns into one jsonb. Greeting and
// instructions still have no live write path (admin-web-{get,update}-memo-config
// were deleted as dead code). models_config.memo.model is SoT for the brain;
// openaiModel remains a one-release fallback inside get-memo-config.

export type MemoConfig = {
  greeting: string;
  instructions: string;
  openaiModel: string;
  perplexityModel: string;
  provider: string;
  webGrounding: boolean;
};

export const DEFAULT_MEMO_CONFIG: MemoConfig = {
  greeting: "",
  instructions: "",
  openaiModel: "gpt-4o-mini",
  perplexityModel: "sonar-pro",
  provider: "openai",
  webGrounding: false,
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}

function text(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeMemoConfig(raw: unknown): MemoConfig {
  const r = asRecord(raw);
  const d = DEFAULT_MEMO_CONFIG;
  return {
    greeting: text(r.greeting, d.greeting),
    instructions: text(r.instructions, d.instructions),
    openaiModel: text(r.openaiModel, d.openaiModel).trim() || d.openaiModel,
    perplexityModel: text(r.perplexityModel, d.perplexityModel).trim() || d.perplexityModel,
    provider: text(r.provider, d.provider).trim() || d.provider,
    webGrounding: r.webGrounding === true,
  };
}
