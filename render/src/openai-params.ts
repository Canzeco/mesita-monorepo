// How one OpenAI chat-completions call is shaped for its model (MESITA-3945).
// Reasoning families (gpt-5*, gpt-6*, o-series) reject a non-default
// `temperature` and the old `max_tokens`; they take `max_completion_tokens`
// and spend hidden reasoning tokens unless `reasoning_effort` is "none", so the
// cheap new options (gpt-6-luna, gpt-5.6-luna, gpt-5.4-nano) run with none.
// Older models (gpt-4o, gpt-4o-mini, gpt-4.1*) keep temperature and max_tokens.
//
// Twin: supabase/supabase/functions/_shared/openai-params.ts, pinned by
// that package's render-twins.fixture.json (twins.test.ts here).

export function isReasoningModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return /^gpt-[5-9]/.test(m) || /^o\d/.test(m);
}

export function openaiParams(
  model: string,
  opts: { temperature?: number; maxTokens?: number },
): Record<string, unknown> {
  if (isReasoningModel(model)) {
    return {
      reasoning_effort: "none",
      ...(opts.maxTokens !== undefined ? { max_completion_tokens: opts.maxTokens } : {}),
    };
  }
  return {
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
  };
}
