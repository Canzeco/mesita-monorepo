// consumer-web-ask-memo — Memo, the consumer AI concierge.
//
// Memo is Mesita's third agent (alongside the Enricher cron pipeline and the
// ElevenLabs Reservationist). Unlike those two, Memo lives here, as an
// Edge Function, because it sits on the consumer's synchronous chat path.
//
// One turn of the concierge chat:
//
//   1. GOOGLE PLACES (Text Search, New) + MESITA DB → the place CANDIDATES.
//      Only when the ask is place-seeking (isPlaceSeeking). Google understands
//      the query (location-biased on lat/lng); results are type-filtered to
//      Mesita's hospitality universe and ranked open-now-first then by rating.
//      Google ids are cross-referenced against projects_view so cards get
//      tagged on-Mesita (partner/web-listed) vs not, and a name search surfaces
//      on-platform spots Google missed. (Future: RAG over the catalog here.)
//
//   2. PERPLEXITY (sonar-pro, web-grounded) → the natural-language ANSWER.
//      The candidates from step 1 are fed to Perplexity as context so its
//      recommendation names the ACTUAL cards the user sees — the prose and the
//      rail stay coherent instead of drifting apart. It still adds web-grounded
//      color (what to order, vibe) + citations + follow-up questions, and can
//      answer ANY question. Non-place-seeking turns skip step 1 and reply text-
//      only. Hidden context feeds the user's location + local time so Memo
//      favours open, time-appropriate spots.
//
// No random-sample fallback: no genuine match → empty rail + text-only reply.
//
// Secrets: PERPLEXITY_KEY (shared with Atlas/ADEA) + GMP_KEY (Google Maps
// Platform, shared with the enricher). Neither key ever leaves Supabase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getOptionalAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import {
  escapeIlike,
  readGooglePlacesKey,
} from "../_shared/google-places.ts";
import {
  type ChannelPolicy,
  readChannelPolicy,
} from "../_shared/sourcing.ts";
import { fallbackAnswer } from "../_shared/memo-fallback.ts";
import { isPlaceSeeking } from "../_shared/memo-intent.ts";
import { readMemoSystemPrompt } from "../_shared/memo-prompt.ts";
import { answerWithPerplexity } from "./memo-answer.ts";
import { readConsumerContext } from "./memo-consumer-context.ts";
import {
  googleTextSearch,
  type Prediction,
  type PredictionStatus,
} from "./memo-google-text-search.ts";
import { toPlainText } from "./memo-text.ts";
import {
  mergeAndRankMemoPredictions,
} from "./memo-catalog-helpers.ts";
import { answerWithAgent } from "./memo-agent.ts";
import { localMoment } from "../_shared/memo-local-moment.ts";

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

// ── Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const bodyRes = await readJson<MemoBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const query = (body.query ?? "").toString().trim();
  if (query.length < 2) {
    return json({ ok: false, error: "Ask me something first." }, 400);
  }

  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;

  // Optional auth — Memo works signed-out; a user id lets us personalise later.
  const { user } = await getOptionalAuthedUser(req, env);

  const admin = adminClient(env);
  const perplexityKey = Deno.env.get("PERPLEXITY_KEY") ?? "";

  // Only look up places when the ask is actually place-seeking — a definition
  // or general question gets a text-only reply (no forced cards).
  const placeSeeking = isPlaceSeeking(query);

  // Memo's persona is operator-tunable from the admin console (Memo Config →
  // app_settings.memo_instructions). Kick the read off now so it overlaps the
  // Google leg; SYSTEM_PROMPT is the fallback when the row is blank/unreadable,
  // so Memo never loses its voice.
  const systemPromptPromise = readMemoSystemPrompt(admin);

  // Signed-in users get a personalised concierge: Memo learns their first name,
  // age and sex from the consumers profile so it can greet by name and tailor
  // suggestions. Read concurrently; signed-out (or a miss) just means no profile
  // context — location still flows from the client either way.
  const profileCtxPromise = user
    ? readConsumerContext(admin, user.id)
    : Promise.resolve<string | null>(null);

  // Memo v-next: the OpenAI reasoning airlock (sources: Perplexity · Lineup RAG
  // · passive public-DB reads). Gated behind MEMO_ENGINE=agent so this ships
  // dark until flipped; returns the exact same response contract as below, so
  // the (already-enabled) frontend is untouched either way.
  if ((Deno.env.get("MEMO_ENGINE") ?? "").trim() === "agent") {
    try {
      const [persona, profileCtx] = await Promise.all([
        systemPromptPromise,
        profileCtxPromise,
      ]);
      const gp = readGooglePlacesKey();
      const agent = await answerWithAgent({
        admin,
        userId: user?.id ?? null,
        query,
        lat,
        lng,
        persona,
        hiddenContext: hiddenMemoContext(profileCtx, lat, lng),
        history: body.history,
        keys: {
          openai: Deno.env.get("OPENAI_KEY") ?? "",
          perplexity: perplexityKey,
          google: gp.ok ? gp.key : "",
        },
        model: (Deno.env.get("MEMO_MODEL") ?? "gpt-4o").trim(),
      });
      return json({
        ok: true,
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
      const memoPolicy = await readChannelPolicy(admin, "memo_search");
      const placeResult = await candidatePlaces(
        admin,
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

  const [systemPrompt, profileCtx] = await Promise.all([
    systemPromptPromise,
    profileCtxPromise,
  ]);
  const perplexity = await answerWithPerplexity(
    perplexityKey,
    systemPrompt,
    query,
    lat,
    lng,
    profileCtx,
    body.history,
    predictions,
  );

  const answer = toPlainText(
    perplexity?.text && perplexity.text.length > 0
      ? perplexity.text
      : fallbackAnswer(query, onMesita, fromGoogle, placeSeeking),
  );

  return json({
    ok: true,
    answer,
    predictions,
    related: perplexity?.related ?? [],
    citations: perplexity?.citations ?? [],
    userId: user?.id ?? null,
  });
});

// ── Leg 2: place candidates (Google Text Search + Mesita merge) ─────────

async function candidatePlaces(
  admin: SupabaseClient,
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

  // Cross-reference Google hits against the Mesita catalog by google_place_id
  // so on-platform spots get the right badge + navigable ids.
  if (googlePreds.length > 0) {
    const byPlaceId = await mesitaByGooglePlaceIds(
      admin,
      googlePreds.map((p) => p.placeId),
    );
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

  // Surface on-Mesita spots by name too (catches ones Google missed / that
  // aren't in the Google result set for this phrasing).
  const mesitaPreds = await mesitaByName(admin, query);

  // Merge, de-dupe by placeId, rank Mesita-first then by Google rating.
  const predictions = mergeAndRankMemoPredictions(mesitaPreds, googlePreds);

  // No random-sample fallback: if nothing genuinely matches, we return an
  // empty rail and Memo replies text-only. Better a clean answer than
  // irrelevant cards (a department store for a nightlife ask).
  return { predictions };
}

async function mesitaByGooglePlaceIds(
  admin: SupabaseClient,
  placeIds: string[],
): Promise<
  Map<
    string,
    { status: PredictionStatus; mesitaId: string; mesitaSlug: string }
  >
> {
  const out = new Map<
    string,
    { status: PredictionStatus; mesitaId: string; mesitaSlug: string }
  >();
  if (placeIds.length === 0) return out;

  const { data, error } = await admin
    .from("projects_view")
    .select("id, slug, google_place_id, listing_type")
    .in("google_place_id", placeIds);
  if (error) {
    console.error("[ask-memo] mesita placeId lookup:", error.message);
    return out;
  }
  for (
    const row of (data ?? []) as {
      id: string;
      slug: string;
      google_place_id: string;
      listing_type: string | null;
    }[]
  ) {
    out.set(row.google_place_id, {
      status: row.listing_type === "partner"
        ? "verified_partner_other"
        : "web_listed",
      mesitaId: row.id,
      mesitaSlug: row.slug,
    });
  }
  return out;
}

async function mesitaByName(
  admin: SupabaseClient,
  query: string,
): Promise<Prediction[]> {
  const { data, error } = await admin
    .from("projects_view")
    .select(
      "id, slug, name, address, google_place_id, listing_type, google_stars_overall, status",
    )
    .ilike("name", `%${escapeIlike(query)}%`)
    .in("status", ["active", "lead"])
    .limit(4);
  if (error) {
    console.error("[ask-memo] mesita name search:", error.message);
    return [];
  }
  return ((data ?? []) as {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    google_place_id: string | null;
    listing_type: string | null;
    google_stars_overall: number | null;
  }[]).map<Prediction>((row) => ({
    // Prefer the Google id as the card key (keeps it aligned with the Google
    // leg for de-dupe); fall back to the Mesita uuid when there's no Google id.
    placeId: row.google_place_id ?? row.id,
    mainText: row.name,
    secondaryText: row.address ?? "On Mesita",
    status: row.listing_type === "partner"
      ? "verified_partner_other"
      : "web_listed",
    mesitaId: row.id,
    mesitaSlug: row.slug,
    rating: row.google_stars_overall,
  }));
}

// Location + local time (+ signed-in profile) the agent reasons over but must
// not recite. Mirrors the legacy hidden context; buildAgentSystemPrompt wraps
// it under a "never recite verbatim" header.
function hiddenMemoContext(
  profileCtx: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  const { clock, daypart } = localMoment(lng);
  const bits: string[] = [];
  if (profileCtx) bits.push(profileCtx);
  if (lat !== null && lng !== null) {
    bits.push(`near latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}`);
  }
  if (clock) bits.push(`local time ${clock} (${daypart})`);
  return bits.length > 0
    ? `The user is ${bits.join("; ")}. Favour places open and appropriate for this time of day.`
    : null;
}
