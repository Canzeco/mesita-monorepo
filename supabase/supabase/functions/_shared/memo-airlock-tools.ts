// memo-airlock-tools.ts — the FIXED, read-only tool set Memo's agent may call.
//
// Four sources, all reads of PUBLIC data:
//   • web_search      → Perplexity (the live web)
//   • places_recommend → the Mesita catalog's RAG recall, via
//                       supabase-edgefunc-recall-places
//   • place_facts     → one named Mesita place, via
//                       supabase-edgefunc-search-places
//   • mesita_knowledge → Mesita's OWN words (_shared/memo-knowledge.ts), the
//                       curated in-house set. Added by MESITA-1201: a question
//                       about classes, Passport, plans or tickets has no answer
//                       on the open web, so before this tool it fell to
//                       web_search and got declined or invented.
//
// Note what these handlers no longer contain: a query. Every Mesita DATA read
// goes through ctx.data (memo-data.ts) to a named Edge Function that owns its
// own SELECT — Memo holds no database client, so a tool CANNOT reach a table its
// endpoint doesn't already serve. (mesita_knowledge reads neither: its rows are
// a code constant, so it adds a source without widening the data surface at
// all.) The airlock's guarantees are as much about
// what is ABSENT as present: no tool writes, reserves, edits, or reads any
// user's private data. None of these tools takes a user id — personalisation
// flows only from the sealed context's authenticated caller, never a
// model-supplied parameter.

import { callPerplexityChat } from "./perplexity-chat.ts";
import { lookupMesitaKnowledge } from "./memo-knowledge.ts";
import type { AirlockContext, AirlockTool, ToolResult } from "./memo-airlock.ts";
import type { MemoPlaceCard } from "./memo-place-card.ts";
import type { Prediction } from "./memo-types.ts";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

const TOOL_CARDS = 4;
/** Fallback only — prefer ctx.perplexityModel from models_config.memo. */
const DEFAULT_PERPLEXITY_MODEL = DEFAULT_MODELS_CONFIG.memo.perplexity!;

// Public card → public Prediction card (the existing frontend contract).
export function cardToPrediction(card: MemoPlaceCard): Prediction {
  return {
    placeId: card.googlePlaceId ?? card.id, // align with the Google leg's key when we have it
    mainText: card.name,
    secondaryText: card.address ?? card.category ?? "On Mesita",
    status: card.listingType === "partner" ? "verified_partner_other" : "web_listed",
    mesitaId: card.id,
    mesitaSlug: card.slug,
    rating: card.rating,
  };
}

// Compact, public-safe lines the model reads about a set of places. No ids.
export function cardsToText(cards: MemoPlaceCard[]): string {
  return cards
    .map((c) => {
      const bits: string[] = [c.name];
      if (c.category) bits.push(c.category);
      if (c.rating != null) bits.push(`${c.rating}★`);
      if (c.address) bits.push(c.address);
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
}

// ── Places recall (source 2) ───────────────────────────────────────────
// Reused both as a tool AND to seed the loop RAG-first (see memo-agent.ts).
// The pool query, the intent embedding and the cosine rank all happen inside
// supabase-edgefunc-recall-places; what comes back is already ranked public
// cards. Deliberately non-persisting on that side too — Memo never writes.
//
// The `places_recommend` tool NAME replaced `lineup_recommend` (MESITA-1216)
// after MESITA-1048 deleted the Lineup engine; the endpoint behind it is
// supabase-edgefunc-recall-places. The old note here said the name was pinned
// because the admin Memo Playground rendered it verbatim — that playground UI
// was dropped when Memo Config moved into Filters › Chat (MESITA-1097), and
// apps/web-admin holds no memo surface today, so nothing outside this repo's
// own Edge Functions reads these names any more.
//
// `opts.traceKind === "recall"` records the RAG-seed step to ctx.trace (with
// pool size + whether it embedded); the plain tool path is recorded generically
// by the airlock's dispatch, so we don't double-record there.
export async function placesRecall(
  ctx: AirlockContext,
  intent: string,
  opts?: { traceKind?: "recall" },
): Promise<ToolResult> {
  const start = Date.now();
  const recall = await ctx.data.recallPlaces({
    intent,
    lat: ctx.lat,
    lng: ctx.lng,
    limit: TOOL_CARDS,
  });

  if (opts?.traceKind === "recall" && ctx.trace) {
    ctx.trace.push({
      kind: "recall",
      title: "Places recall · RAG seed",
      source: "Place recall",
      intent,
      poolSize: recall.poolSize,
      embedded: recall.embedded,
      cards: recall.cards.map((c) => ({ name: c.name, rating: c.rating })),
      ms: Date.now() - start,
    });
  }

  if (recall.cards.length === 0) {
    return { text: "No Mesita places matched near there yet." };
  }
  return {
    text: `Mesita's picks for this ask (public catalog):\n${cardsToText(recall.cards)}`,
    predictions: recall.cards.map(cardToPrediction),
  };
}

// ── The four tools ─────────────────────────────────────────────────────

const webSearchTool: AirlockTool = {
  name: "web_search",
  description:
    "Search the live web for facts, news, what-to-order, vibe, or anything you're unsure about. Returns a grounded summary with sources. Use for general knowledge and current info — NOT for finding Mesita places (use places_recommend for that).",
  schema: {
    properties: {
      query: {
        type: "string",
        description: "What to look up, in natural language.",
        maxLen: 400,
      },
    },
    required: ["query"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const query = String(args.query ?? "");
    if (!ctx.keys.perplexity) return { text: "Web search is unavailable right now." };
    const res = await callPerplexityChat(
      ctx.keys.perplexity,
      [
        { role: "system", content: "Answer concisely and factually, with sources." },
        { role: "user", content: query },
      ],
      {
        model: ctx.perplexityModel?.trim() || DEFAULT_PERPLEXITY_MODEL,
        maxTokens: 500,
        temperature: 0.2,
        returnRelated: true,
      },
    );
    if (!res) return { text: "Couldn't reach the web just now." };
    return { text: res.text, citations: res.citations, related: res.related };
  },
};

const placesTool: AirlockTool = {
  name: "places_recommend",
  description:
    "Mesita's own ranked recommendations for what the person wants — bars, restaurants, cafés, nightlife, experiences near them. This is the primary way to suggest places. Pass their need in natural language; results appear as cards.",
  schema: {
    properties: {
      intent: {
        type: "string",
        description:
          "What they want, e.g. 'rooftop cocktails in Providencia' or 'quiet café to work'.",
        maxLen: 300,
      },
    },
    required: ["intent"],
  },
  run(args, ctx): Promise<ToolResult> {
    return placesRecall(ctx, String(args.intent ?? ""));
  },
};

const placeFactsTool: AirlockTool = {
  name: "place_facts",
  description:
    "Look up a SPECIFIC Mesita place by name to get its public facts — category, rating, neighbourhood. Use when the person names a place or asks about one in particular.",
  schema: {
    properties: {
      name: {
        type: "string",
        description: "The place name to look up.",
        maxLen: 120,
      },
    },
    required: ["name"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const name = String(args.name ?? "").trim();
    if (name.length < 2) return { text: "Give me a place name to look up." };
    const cards = await ctx.data.searchPlaces({ name, limit: TOOL_CARDS });
    if (cards.length === 0) return { text: `No Mesita place named "${name}" found.` };
    return { text: cardsToText(cards), predictions: cards.map(cardToPrediction) };
  },
};

const knowledgeTool: AirlockTool = {
  name: "mesita_knowledge",
  description:
    "Mesita's own explanations of how Mesita works — classes (Bronze/Silver/Gold/Diamond), the Passport, plans (Free/Premium), how the discount is computed, tickets, reservations, rewards and what a restaurant does or doesn't see. ALWAYS use this, never the web, when the person asks about Mesita itself: the answer is not published anywhere, so a web search will only guess.",
  schema: {
    properties: {
      topic: {
        type: "string",
        description: "What they asked about Mesita, in their own words.",
        maxLen: 200,
      },
    },
    required: ["topic"],
  },
  // The only tool with nothing to await: its rows are a local constant, not an
  // endpoint. It still returns a Promise to keep the AirlockTool contract.
  run(args, _ctx): Promise<ToolResult> {
    const topic = String(args.topic ?? "").trim();
    // Audience is hardcoded "guest" here and NOT model-supplied: this tool sits
    // on the consumer concierge, and an audience the model could pass would be
    // one prompt injection away from unlocking the internal rows.
    const hits = lookupMesitaKnowledge(topic, "guest");
    if (hits.length === 0) {
      return Promise.resolve({
        text:
          "Mesita's own knowledge has nothing on that. Say you're not sure rather than guessing — and do NOT search the web for it, since Mesita's workings aren't published anywhere.",
      });
    }
    return Promise.resolve({
      text: hits.map((h) => `${h.topic}: ${h.fact}`).join("\n\n"),
    });
  },
};

// The fixed registry. Adding a capability means adding a READ tool here — there
// is intentionally no write/reserve/edit/delete tool to add, and no endpoint on
// Memo's data surface (config.toml, supabase-edgefunc-*) that would serve one.
export function buildMemoTools(): AirlockTool[] {
  return [placesTool, webSearchTool, placeFactsTool, knowledgeTool];
}
