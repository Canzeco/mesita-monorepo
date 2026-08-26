// consumer-web-ask-memo — Memo, the consumer Chat concierge.
//
// Stateless OpenAI turn (MESITA-1337): the client resends the Discovery
// system prompt plus the full thread on every message. No Places, Perplexity,
// catalog, or consumer-context tools this pass — those return as named APIs
// later. Memo still holds no database client: greeting / prompt / model come
// from supabase-edgefunc-get-memo-config (which reads discovery_config.chat).
//
// Secrets: OPENAI_KEY. Never leaves Supabase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { resolveMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { createMemoData } from "../_shared/memo-data.ts";
import { DEFAULT_MODELS_CONFIG } from "../_shared/models-config.ts";
import { completeChatTurn, sanitizeChatHistory } from "../_shared/memo-openai-turn.ts";
import { toPlainText } from "../_shared/memo-text.ts";

type MemoBody = {
  query?: string;
  latitude?: number;
  longitude?: number;
  history?: unknown;
};

const CONFIG_CACHE_MS = 30_000;
const LINE_DROPPED =
  "Hmm, my line dropped for a second — give it another try in a moment.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const bodyRes = await readJson<MemoBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const query = (body.query ?? "").toString().trim();
  const { user } = await getOptionalAuthedUser(req, env);

  const data = createMemoData(env, "consumer-web-ask-memo", {
    cacheMs: CONFIG_CACHE_MS,
  });
  const configPromise = data.config();

  if (query.length === 0) {
    const cfg = await configPromise;
    return json({
      ok: true,
      greeting: cfg.greeting,
      answer: "",
      predictions: [],
      related: [],
      citations: [],
      userId: user?.id ?? null,
    });
  }
  if (query.length < 2) {
    return json({ ok: false, error: "Ask me something first." }, 400);
  }

  const cfg = await configPromise;
  const answer = await completeChatTurn({
    openaiKey: Deno.env.get("OPENAI_KEY") ?? "",
    model: (cfg.model ?? DEFAULT_MODELS_CONFIG.memo.model!).trim(),
    system: resolveMemoSystemPrompt(cfg.instructions),
    history: sanitizeChatHistory(body.history),
    query,
  });

  return json({
    ok: true,
    greeting: cfg.greeting,
    answer: toPlainText(answer && answer.length > 0 ? answer : LINE_DROPPED),
    predictions: [],
    related: [],
    citations: [],
    userId: user?.id ?? null,
  });
});
