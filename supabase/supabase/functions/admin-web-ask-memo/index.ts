// Supabase Edge Function — admin-web-ask-memo
//
// The Memo Config Playground's engine: run Memo's v-next REASONING AGENT for a
// super-admin from the admin console, returning a full TRACE of how it thought —
// the RAG-first Lineup recall, each OpenAI reasoning round, and every tool call
// (Lineup engine / Perplexity / Mesita catalog).
//
// This is the dedicated admin door the old playground's comment promised. It:
//   • fixes the ACL bend — the playground was calling consumer-web-ask-memo
//     (admin origin → consumer endpoint); this is the admin-origin door.
//   • does what a consumer EF safely can't: talk AS any persona (a real
//     consumer read from `consumers`, a mock one, or a signed-out guest),
//     override the persona draft (test unsaved Config edits), and return the
//     internal reasoning trace.
//   • ALWAYS runs the agent engine, regardless of the consumer-facing
//     MEMO_ENGINE flag — inspecting/polishing that agent is the whole point of
//     the playground (it's currently held back for consumers, MESITA-729).
//
// Read-only: nothing here writes config or user data. The agent's airlock is
// read-only by construction (see _shared/memo-airlock.ts), and Memo reaches
// Mesita data ONLY through the four internal EFs behind _shared/memo-data.ts —
// so the playground dogfoods the identical data surface production runs on.
// The service-role client below is this EF's OWN (super-admin gate); it is
// never handed to Memo.
//
// Naming: caller-origin-verb-noun → admin · web · ask · memo.
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import { resolveMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { mockConsumerContext } from "../_shared/memo-consumer-context.ts";
import { createMemoData } from "../_shared/memo-data.ts";
import { buildHiddenMemoContext } from "../_shared/memo-hidden-context.ts";
import { answerWithAgent } from "../_shared/memo-agent.ts";
import type { TraceSink } from "../_shared/memo-trace.ts";

const DEFAULT_MODEL = "gpt-4o";
// The same picker the admin Memo Config offers (types.ts OPENAI_MODELS) — an
// override outside this set is ignored in favour of the saved/default model.
const OPENAI_MODELS = new Set([
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
]);

type MockProfile = { name?: unknown; age?: unknown; sex?: unknown };

type Body = {
  query?: unknown;
  history?: { role?: unknown; content?: unknown }[];
  // Persona context — one of: a real consumer (uuid, profile read live), a
  // mock persona, or neither (signed-out guest). consumerId wins if both given.
  consumerId?: unknown;
  mockProfile?: MockProfile;
  // Location the concierge reasons over (Memo is location-first).
  latitude?: unknown;
  longitude?: unknown;
  // OPTIONAL persona draft override (test unsaved Config edits without saving).
  instructions?: unknown;
  // OPTIONAL model override (else the saved memo_openai_model, else default).
  model?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const query = (typeof body.query === "string" ? body.query : "").trim();
  if (query.length < 2) {
    return json({ ok: false, error: "Ask Memo something first." }, 400);
  }

  const lat = typeof body.latitude === "number" && Number.isFinite(body.latitude)
    ? body.latitude
    : null;
  const lng = typeof body.longitude === "number" && Number.isFinite(body.longitude)
    ? body.longitude
    : null;

  // Memo's data surface — the same four internal EFs the consumer path uses.
  // Uncached on purpose (no cacheMs): the consumer path reuses config reads for
  // ~30s, but this page exists to test the persona you JUST saved, so a stale
  // read here would look like a broken Save.
  const data = createMemoData(envRes.env, "admin-web-ask-memo");

  // Saved persona + model in one hop (supabase-edgefunc-get-memo-config).
  const cfg = await data.config();

  // Persona: the saved instructions, or an operator draft override so unsaved
  // Config edits can be tested here without saving first (the old caveat).
  const override = typeof body.instructions === "string"
    ? body.instructions.trim()
    : "";
  const persona = override.length > 0
    ? override
    : resolveMemoSystemPrompt(cfg.instructions);

  // Model: the operator's pick (if valid), else the saved memo_openai_model,
  // else the default — so the playground reflects the configured brain.
  const modelOverride = typeof body.model === "string" ? body.model.trim() : "";
  const model = modelOverride && OPENAI_MODELS.has(modelOverride)
    ? modelOverride
    : (cfg.model ?? DEFAULT_MODEL);

  // Persona context: a real consumer's profile clause (served by
  // supabase-edgefunc-get-consumer-context — the raw row never comes back
  // here), a mock persona, or none (guest). A real consumerId wins over a mock.
  const consumerId =
    typeof body.consumerId === "string" && body.consumerId.length > 0
      ? body.consumerId
      : null;
  let profileCtx: string | null = null;
  let profileKind: "consumer" | "mock" | "guest" = "guest";
  if (consumerId) {
    profileCtx = await data.consumerContext(consumerId);
    profileKind = "consumer";
  } else if (body.mockProfile && typeof body.mockProfile === "object") {
    profileCtx = mockConsumerContext(body.mockProfile as MockProfile);
    if (profileCtx) profileKind = "mock";
  }

  const hiddenContext = buildHiddenMemoContext(profileCtx, lat, lng);

  // The reasoning trace the playground inspects — filled in-place by the agent.
  const trace: TraceSink = [];
  try {
    const gp = readGooglePlacesKey();
    const agent = await answerWithAgent({
      data,
      userId: consumerId,
      query,
      lat,
      lng,
      persona,
      hiddenContext,
      history: Array.isArray(body.history) ? body.history : undefined,
      keys: {
        openai: Deno.env.get("OPENAI_KEY") ?? "",
        perplexity: Deno.env.get("PERPLEXITY_KEY") ?? "",
        google: gp.ok ? gp.key : "",
      },
      model,
      trace,
    });

    return json({
      ok: true,
      answer: agent.answer,
      predictions: agent.predictions,
      related: agent.related,
      citations: agent.citations,
      trace,
      meta: {
        engine: "agent",
        model,
        personaSource: override.length > 0 ? "override" : "saved",
        profile: profileKind,
        hiddenContext,
      },
    });
  } catch (e) {
    console.error("[admin-ask-memo] agent failed:", (e as Error).message);
    return json({ ok: false, error: `agent_failed: ${(e as Error).message}` }, 500);
  }
});
