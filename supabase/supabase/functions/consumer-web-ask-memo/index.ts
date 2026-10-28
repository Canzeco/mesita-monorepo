// consumer-web-ask-memo — Memo, the consumer Chat concierge.
//
// Stateless OpenAI turn (MESITA-1337): the client resends the full thread on
// every message. THE CHAT AGENT SITS ABOVE THE PIPELINES (MESITA-2327,
// MESITA-2339): before the model answers, `_shared/chat-agent.ts` reads the
// guest's intent once and calls the pipelines it needs — Name for a place
// they name, Area (ready Mesita places around their location) for families or
// "near me", Deep for a qualitative need — and hands the model those places
// as context (`places` on the wire; `related` stays the follow-up chips the
// client renders as strings). It never calls a source itself. Passive:
// nothing here writes. Greeting / prompt / model come from
// supabase-edgefunc-get-memo-config (which reads discovery_config.chat).
//
// Secrets: OPENAI_KEY. Never leaves Supabase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { type DiscoveryConfig, loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { deepDepsFor, runDeepPipeline } from "../_shared/deep-pipeline.ts";
import { areaMesitaPlaces } from "../_shared/area-pipeline.ts";
import { nameGooglePlaces } from "../_shared/consumer-search-lane.ts";
import {
  type ChatPipelines,
  type ChatPlace,
  chatContextForModel,
  extractChatIntent,
  runChatAgent,
} from "../_shared/chat-agent.ts";
import { resolveMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { createMemoData } from "../_shared/memo-data.ts";
import { DEFAULT_MODELS_CONFIG } from "../_shared/models-config.ts";
import { completeChatTurn, sanitizeChatHistory } from "../_shared/memo-openai-turn.ts";
import { toPlainText } from "../_shared/memo-text.ts";

type MemoBody = {
  query?: string;
  history?: unknown;
  /** The guest's location, when they shared it (Area's anchor). */
  latitude?: unknown;
  longitude?: unknown;
};

function anchorOf(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = typeof lat === "number" ? lat : Number.NaN;
  const b = typeof lng === "number" ? lng : Number.NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

const CONFIG_CACHE_MS = 30_000;
const LINE_DROPPED =
  "Hmm, my line dropped for a second — give it another try in a moment.";

serveJson("consumer-web-ask-memo", async (req) => {
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
  const history = sanitizeChatHistory(body.history);
  const anchor = anchorOf(body.latitude, body.longitude);
  const modelOf = (c: Awaited<typeof configPromise>) =>
    (c.model ?? DEFAULT_MODELS_CONFIG.memo.model!).trim();
  // The memo config and the Chat Agent overlap: the agent needs only the
  // model name from it, and reads Discovery's config meanwhile.
  const [cfg, places] = await Promise.all([
    configPromise,
    chatPlacesFor(env, query, history, anchor, openaiKey, configPromise.then(modelOf)),
  ]);
  const system = resolveMemoSystemPrompt(cfg.instructions);
  const context = chatContextForModel(places, { hasAnchor: anchor !== null });
  const answer = await completeChatTurn({
    openaiKey,
    model: modelOf(cfg),
    system: context ? `${system}\n\n${context}` : system,
    history,
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
    // The places the pipelines handed Chat this turn, and why.
    places: places.map((p) => ({ id: p.id, slug: p.slug, name: p.name, why: p.why })),
  });
});

const toChatPlace = (why: ChatPlace["why"]) => (row: Record<string, unknown>): ChatPlace => ({
  id: String(row.id ?? ""),
  slug: typeof row.slug === "string" ? row.slug : null,
  name: String(row.name ?? ""),
  address: typeof row.address === "string" ? row.address : null,
  familyKeys: Array.isArray(row.family_keys) ? (row.family_keys as string[]) : [],
  rating: typeof row.google_stars_overall === "number" ? row.google_stars_overall : null,
  reviewCount: typeof row.google_review_count === "number" ? row.google_review_count : null,
  about: typeof row.description === "string" ? row.description.slice(0, 280) : null,
  distanceKm: typeof row.distance_km === "number" ? row.distance_km : null,
  why,
});

/** The pipelines Chat may call this turn, over Memo's one database client:
 *  each reads through its own pipeline module, read-only. */
function chatPipelines(
  admin: ReturnType<typeof adminClient>,
  discovery: DiscoveryConfig,
  anchor: { lat: number; lng: number } | null,
  openaiKey: string,
): ChatPipelines {
  const limit = discovery.deep.limit;
  return {
    hasAnchor: anchor !== null,
    // Google's name is canonical (MESITA-2896): Text Search, kept where
    // Mesita holds the place.
    name: async (placeName) =>
      (await nameGooglePlaces(admin, discovery.map, discovery.general, placeName, anchor, limit))
        .map((row) => toChatPlace("name")(row as unknown as Record<string, unknown>)),
    area: async (families) =>
      ((await areaMesitaPlaces(admin, discovery, { center: anchor, families, limit })) ?? [])
        .map(toChatPlace("area")),
    deep: async (text) =>
      (await runDeepPipeline({ query: text, config: discovery.deep, ...deepDepsFor(admin, discovery.general, openaiKey) }))
        .places.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          address: p.address,
          familyKeys: p.familyKeys,
          rating: p.rating,
          reviewCount: p.reviewCount,
          about: p.about,
          distanceKm: null,
          why: "deep" as const,
        })),
  };
}

/** The Chat Agent for this turn. Best effort: any failure leaves Chat
 *  answering from its prompt alone, never a failed turn. */
async function chatPlacesFor(
  env: Parameters<typeof adminClient>[0],
  query: string,
  history: ReturnType<typeof sanitizeChatHistory>,
  anchor: { lat: number; lng: number } | null,
  openaiKey: string,
  modelPromise: Promise<string>,
): Promise<ChatPlace[]> {
  try {
    const admin = adminClient(env);
    const [discovery, model] = await Promise.all([loadDiscoveryConfig(admin), modelPromise]);
    const result = await runChatAgent(
      query,
      () => extractChatIntent({ openaiKey, model, query, history }),
      chatPipelines(admin, discovery, anchor, openaiKey),
      // The operator's "Places handed to Chat" caps the whole list.
      discovery.deep.limit,
    );
    return result.places;
  } catch (err) {
    console.error("[consumer-web-ask-memo] chat agent:", err instanceof Error ? err.message : err);
    return [];
  }
}
