// consumer-web-ask-memo — Memo, the consumer AI concierge.
//
// Memo is Mesita's third agent (alongside the Intaker cron pipeline and the
// ElevenLabs Reservationist). Unlike those two, Memo lives here, as an
// Edge Function, because it sits on the consumer's synchronous chat path.
//
// MEMO HOLDS NO DATABASE CLIENT. Every Mesita read on both engines below goes
// through _shared/memo-data.ts to one of four named, read-only internal EFs
// (recall-places · search-places · get-consumer-context · get-memo-config).
// This EF authenticates the consumer and shapes the reply; it does not query.
// See memo-data.ts for why, and admin.mesita.ai/memo-config (Data Access) for
// the operator-facing map of that surface.
//
// One turn of the concierge chat:
//
//   1. GOOGLE PLACES (Text Search, New) + MESITA CATALOG → the place CANDIDATES.
//      Only when the ask is place-seeking (isPlaceSeeking). Google understands
//      the query (location-biased on lat/lng); results are type-filtered to
//      Mesita's hospitality universe and ranked open-now-first then by rating.
//      Google ids are cross-referenced against the catalog (via search-places)
//      so cards get tagged on-Mesita (partner/web-listed) vs not, and a name
//      search surfaces on-platform spots Google missed.
//
//   2. PERPLEXITY (sonar-pro, web-grounded) → the natural-language ANSWER.
//      The candidates from step 1 are fed to Perplexity as context so its
//      recommendation names the ACTUAL cards the user sees — the prose and the
//      rail stay coherent instead of drifting apart. It still adds web-grounded
//      color (what to order, vibe) + citations + follow-up questions, and can
//      answer ANY question. Non-place-seeking turns skip step 1 and reply text-
//      only. Hidden context feeds the user's location + local time so Memo
//      favours open, time-appropriate spots. Asks about MESITA ITSELF (classes,
//      Passport, plans, tickets, how a discount resolves) additionally carry
//      our own curated facts into the prompt (_shared/memo-knowledge.ts) —
//      none of that is on the open web for Perplexity to retrieve.
//
// No random-sample fallback: no genuine match → empty rail + text-only reply.
//
// Secrets: PERPLEXITY_KEY (shared with Atlas/ADEA) + GMP_KEY (Google Maps
// Platform, shared with the enricher). Neither key ever leaves Supabase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import type { ChannelPolicy } from "../_shared/sourcing.ts";
import { fallbackAnswer } from "../_shared/memo-fallback.ts";
import { isPlaceSeeking } from "../_shared/memo-intent.ts";
import { resolveMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { answerWithPerplexity } from "./memo-answer.ts";
import { createMemoData, type MemoData } from "../_shared/memo-data.ts";
import { DEFAULT_MODELS_CONFIG } from "../_shared/models-config.ts";
import { cardToPrediction } from "../_shared/memo-airlock-tools.ts";
import {
  googleTextSearch,
  type Prediction,
  type PredictionStatus,
} from "./memo-google-text-search.ts";
import { toPlainText } from "../_shared/memo-text.ts";
import {
  mergeAndRankMemoPredictions,
} from "./memo-catalog-helpers.ts";
import { answerWithAgent } from "../_shared/memo-agent.ts";
import { buildHiddenMemoContext } from "../_shared/memo-hidden-context.ts";

// ── Types ──────────────────────────────────────────────────────────────

type MemoBody = {
  query?: string;
  latitude?: number;
  longitude?: number;
  // Prior turns for conversational context (most recent last).
  history?: { role?: unknown; content?: unknown }[];
};

// ── Tuning ─────────────────────────────────────────────────────────────

const MAX_CARDS = 3;
// The on-Mesita name sweep in the legacy pipeline.
const NAME_SWEEP_LIMIT = 4;
// How long a warm isolate may reuse the config + persona-clause reads. Short
// enough that an operator's Memo Config save feels immediate, long enough to
// cover a whole conversation.
const CONFIG_CACHE_MS = 30_000;

// ── Handler ────────────────────────────────────────────────────────────

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

  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;

  // Optional auth — Memo works signed-out; a user id lets us personalise later.
  const { user } = await getOptionalAuthedUser(req, env);

  // Memo's whole reach, on either engine.
  //
  // Config + persona-clause reads are cached briefly (see memo-data.ts): this
  // is the consumer's synchronous chat path, app_config changes a few times a
  // week, and a chat asks for the same user's clause on every turn. Place reads
  // are never cached — those are the answer. An operator's Config save takes
  // effect within CONFIG_CACHE_MS; the admin Playground opts out entirely so it
  // always tests what was just saved.
  const data = createMemoData(env, "consumer-web-ask-memo", {
    cacheMs: CONFIG_CACHE_MS,
  });
  const perplexityKey = Deno.env.get("PERPLEXITY_KEY") ?? "";

  // Memo's persona + the memo_search sourcing policy are operator-tunable from
  // the admin console (Memo Config). One hop fetches both; kick it off now so
  // it overlaps the Google leg. Every field degrades to a default, so a config
  // hiccup never costs Memo its voice.
  const configPromise = data.config();

  // Empty query = thread bootstrap: return the configured opener only (no AI
  // spend). Consumers use this so memo_config.greeting is not a dead admin knob.
  // A 1-char query is still rejected — that is not a real ask.
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

  // Only look up places when the ask is actually place-seeking — a definition
  // or general question gets a text-only reply (no forced cards).
  const placeSeeking = isPlaceSeeking(query);

  // Signed-in users get a personalised concierge: Memo learns their first name,
  // age and sex as a ready-made clause (the raw profile never leaves the
  // consumer-context EF). Read concurrently; signed-out (or a miss) just means
  // no profile context — location still flows from the client either way.
  const profileCtxPromise = user
    ? data.consumerContext(user.id)
    : Promise.resolve<string | null>(null);

  // Memo v-next: the OpenAI reasoning airlock (sources: Perplexity · catalog
  // RAG · passive public catalog reads · our own curated Mesita knowledge).
  // Gated behind MEMO_ENGINE=agent so this
  // ships dark until flipped; returns the exact same response contract as below,
  // so the (already-enabled) frontend is untouched either way.
  if ((Deno.env.get("MEMO_ENGINE") ?? "").trim() === "agent") {
    try {
      const [cfg, profileCtx] = await Promise.all([
        configPromise,
        profileCtxPromise,
      ]);
      const gp = readGooglePlacesKey();
      const agent = await answerWithAgent({
        data,
        userId: user?.id ?? null,
        query,
        lat,
        lng,
        persona: resolveMemoSystemPrompt(cfg.instructions),
        hiddenContext: buildHiddenMemoContext(profileCtx, lat, lng),
        history: body.history,
        keys: {
          openai: Deno.env.get("OPENAI_KEY") ?? "",
          perplexity: perplexityKey,
          google: gp.ok ? gp.key : "",
        },
        // models_config.memo.model via get-memo-config (MEMO_MODEL env retired).
        model: (cfg.model ?? DEFAULT_MODELS_CONFIG.memo.model!).trim(),
        perplexityModel: (cfg.perplexity ?? DEFAULT_MODELS_CONFIG.memo.perplexity!).trim(),
      });
      return json({
        ok: true,
        greeting: cfg.greeting,
        answer: agent.answer,
        predictions: agent.predictions,
        related: agent.related,
        citations: agent.citations,
        userId: user?.id ?? null,
      });
    } catch (e) {
      // Dark-launch safety net: any agent-path failure degrades to the proven
      // legacy pipeline below instead of 500-ing the consumer.
      console.error(
        "[ask-memo] agent path failed, falling back to legacy:",
        (e as Error).message,
      );
    }
  }

  // Candidates FIRST (place-seeking only), so Perplexity can write its
  // recommendation ABOUT the exact cards the user sees — prose and rail stay
  // coherent. The Google leg is ~0.5s; worth the small serialization for a
  // reply that names the real cards. Never let it sink the answer.
  let predictions: Prediction[] = [];
  if (placeSeeking) {
    try {
      const memoPolicy = (await configPromise).searchPolicy;
      const placeResult = await candidatePlaces(
        data,
        query,
        lat,
        lng,
        memoPolicy,
      );
      predictions = placeResult.predictions.slice(0, MAX_CARDS);
    } catch (e) {
      console.error("[ask-memo] places leg:", (e as Error).message);
    }
  }
  const onMesita = predictions.filter((p) =>
    p.status !== "not_in_mesita"
  ).length;
  const fromGoogle = predictions.length - onMesita;

  const [cfg, profileCtx] = await Promise.all([
    configPromise,
    profileCtxPromise,
  ]);
  const perplexity = await answerWithPerplexity(
    perplexityKey,
    resolveMemoSystemPrompt(cfg.instructions),
    query,
    lat,
    lng,
    profileCtx,
    body.history,
    predictions,
    cfg.perplexity ?? DEFAULT_MODELS_CONFIG.memo.perplexity!,
  );

  const answer = toPlainText(
    perplexity?.text && perplexity.text.length > 0
      ? perplexity.text
      : fallbackAnswer(query, onMesita, fromGoogle, placeSeeking),
  );

  return json({
    ok: true,
    greeting: cfg.greeting,
    answer,
    predictions,
    related: perplexity?.related ?? [],
    citations: perplexity?.citations ?? [],
    userId: user?.id ?? null,
  });
});

// ── Leg 2: place candidates (Google Text Search + Mesita merge) ─────────

async function candidatePlaces(
  data: MemoData,
  query: string,
  lat: number | null,
  lng: number | null,
  memoPolicy: ChannelPolicy,
): Promise<{ predictions: Prediction[] }> {
  const keyRes = readGooglePlacesKey();

  let googlePreds: Prediction[] = [];
  if (keyRes.ok) {
    googlePreds = await googleTextSearch(
      keyRes.key,
      query,
      lat,
      lng,
      memoPolicy,
    );
  }

  // Two independent catalog reads, both served by supabase-edgefunc-search-places:
  //   • by Google id — badge/navigate the hits Google just returned
  //   • by name      — surface on-Mesita spots Google missed (or didn't return
  //                    for this phrasing)
  // The id leg needs Google's results, so it can only start now; run both together.
  const [byIdCards, nameCards] = await Promise.all([
    googlePreds.length > 0
      ? data.searchPlaces({ googlePlaceIds: googlePreds.map((p) => p.placeId) })
      : Promise.resolve([]),
    data.searchPlaces({ name: query, limit: NAME_SWEEP_LIMIT }),
  ]);

  // Cross-reference Google hits against the Mesita catalog by google_place_id
  // so on-platform spots get the right badge + navigable ids.
  if (byIdCards.length > 0) {
    const byPlaceId = new Map<
      string,
      { status: PredictionStatus; mesitaId: string; mesitaSlug: string }
    >();
    for (const card of byIdCards) {
      if (!card.googlePlaceId) continue;
      byPlaceId.set(card.googlePlaceId, {
        status: card.listingType === "partner"
          ? "verified_partner_other"
          : "web_listed",
        mesitaId: card.id,
        mesitaSlug: card.slug,
      });
    }
    for (const p of googlePreds) {
      const m = byPlaceId.get(p.placeId);
      if (m) {
        p.status = m.status;
        p.mesitaId = m.mesitaId;
        p.mesitaSlug = m.mesitaSlug;
        if (!p.secondaryText) p.secondaryText = "On Mesita";
      }
    }
  }

  // Merge, de-dupe by placeId, rank Mesita-first then by Google rating.
  //
  // No random-sample fallback: if nothing genuinely matches, we return an
  // empty rail and Memo replies text-only. Better a clean answer than
  // irrelevant cards (a department store for a nightlife ask).
  const predictions = mergeAndRankMemoPredictions(
    nameCards.map(cardToPrediction),
    googlePreds,
  );

  return { predictions };
}
