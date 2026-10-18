// consumer-web-ask-memo — Memo, the consumer Chat concierge.
//
// Stateless OpenAI turn (MESITA-1337): the client resends the Discovery
// system prompt plus the full thread on every message. THE CHAT AGENT SITS
// ABOVE THE PIPELINES (MESITA-2327): before the model answers, it runs the
// Deep pipeline on the guest's message and hands the model those places as
// context (`places` on the wire; `related` stays the follow-up chips the
// client renders as strings, MESITA-2338). It never calls a source itself. Passive:
// nothing here writes. Greeting / prompt / model come from
// supabase-edgefunc-get-memo-config (which reads discovery_config.chat).
//
// Secrets: OPENAI_KEY. Never leaves Supabase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import {
  type DeepPlace,
  deepContextForChat,
  deepDepsFor,
  runDeepPipeline,
} from "../_shared/deep-pipeline.ts";
import { resolveMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { createMemoData } from "../_shared/memo-data.ts";
import { DEFAULT_MODELS_CONFIG } from "../_shared/models-config.ts";
import { completeChatTurn, sanitizeChatHistory } from "../_shared/memo-openai-turn.ts";
import { toPlainText } from "../_shared/memo-text.ts";

type MemoBody = {
  query?: string;
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
    });
  }
  if (query.length < 2) {
    return json({ ok: false, error: "Ask me something first." }, 400);
  }

  const openaiKey = Deno.env.get("OPENAI_KEY") ?? "";
  const [cfg, places] = await Promise.all([
    configPromise,
    deepPlacesFor(env, query, openaiKey),
  ]);
  const system = resolveMemoSystemPrompt(cfg.instructions);
  const context = deepContextForChat(places);
  const answer = await completeChatTurn({
    openaiKey,
    model: (cfg.model ?? DEFAULT_MODELS_CONFIG.memo.model!).trim(),
    system: context ? `${system}\n\n${context}` : system,
    history: sanitizeChatHistory(body.history),
    query,
  });

  return json({
    ok: true,
    greeting: cfg.greeting,
    answer: toPlainText(answer && answer.length > 0 ? answer : LINE_DROPPED),
    predictions: [],
    // Follow-up chips: the client renders each item as a string. Memo
    // suggests none yet.
    related: [],
    // Deep's places for this turn, best first.
    places: places.map((p) => ({ id: p.id, slug: p.slug, name: p.name, similarity: p.similarity })),
  });
});

/** The Deep pipeline for this turn. Best effort: a pipeline failure leaves
 *  Chat answering from its prompt alone, never a failed turn. */
async function deepPlacesFor(
  env: Parameters<typeof adminClient>[0],
  query: string,
  openaiKey: string,
): Promise<DeepPlace[]> {
  try {
    const admin = adminClient(env);
    const discovery = await loadDiscoveryConfig(admin);
    const result = await runDeepPipeline({
      query,
      config: discovery.deep,
      ...deepDepsFor(admin, discovery.general, openaiKey),
    });
    return result.places;
  } catch (err) {
    console.error("[consumer-web-ask-memo] deep:", err instanceof Error ? err.message : err);
    return [];
  }
}
