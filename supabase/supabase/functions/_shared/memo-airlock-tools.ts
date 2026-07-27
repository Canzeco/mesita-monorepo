// memo-airlock-tools.ts — the FIXED, read-only tool set Memo's agent may call.
//
// Exactly three sources, matching Pato's design, all reads of PUBLIC data:
//   • web_search      → Perplexity (the live web)
//   • lineup_recommend→ Lineup, Mesita's candidate engine: pgvector RAG over
//                       the catalog (fetchCandidatePool + embed + cosine)
//   • place_facts     → a direct indexed read of one named Mesita place
//
// The airlock's guarantees are as much about what is ABSENT as present: no
// tool writes, reserves, edits, or reads any user's private data. Every row
// returned here is public catalog data (name, category, rating, neighbourhood).
// None of these tools takes a user id — personalisation flows only from the
// sealed context's authenticated caller, never a model-supplied parameter.

import { callPerplexityChat } from "./perplexity-chat.ts";
import { fetchCandidatePool, type PlaceRow } from "./recommender-pool.ts";
import { embedSingle, rankByCosine } from "./embeddings.ts";
import { escapeIlike } from "./google-places.ts";
import type { AirlockContext, AirlockTool, ToolResult } from "./memo-airlock.ts";
import type { Prediction } from "./memo-types.ts";

const RECALL_RADIUS_KM = 25;
const RECALL_POOL = 200;
const TOOL_CARDS = 4;
const PERPLEXITY_MODEL = "sonar-pro";

// Public catalog columns a place lookup selects — deliberately NO private or
// user-scoped fields. Kept in one place so the whitelist is auditable.
const PLACE_PUBLIC_SELECT =
  "id, slug, name, address, category, listing_type, google_place_id, google_stars_overall";

// Extra public columns some rows carry (present on projects_view; PlaceRow's
// index signature makes them `unknown`, so read them defensively).
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Public catalog row → public Prediction card (the existing frontend contract).
function rowToPrediction(row: PlaceRow): Prediction {
  const gp = str((row as Record<string, unknown>).google_place_id);
  return {
    placeId: gp ?? row.id, // align with the Google leg's key when we have it
    mainText: row.name,
    secondaryText: row.address ?? (row.category ? String(row.category) : "On Mesita"),
    status: row.listing_type === "partner" ? "verified_partner_other" : "web_listed",
    mesitaId: row.id,
    mesitaSlug: row.slug,
    rating: num((row as Record<string, unknown>).google_stars_overall),
  };
}

// Compact, public-safe lines the model reads about a set of places. No ids.
function placesToText(rows: PlaceRow[]): string {
  return rows
    .map((r) => {
      const bits: string[] = [r.name];
      if (r.category) bits.push(String(r.category));
      const stars = num((r as Record<string, unknown>).google_stars_overall);
      if (stars != null) bits.push(`${stars}★`);
      if (r.address) bits.push(String(r.address));
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
}

// ── Lineup recall (source 2) ───────────────────────────────────────────
// The Lineup engine's RAG leg, read-only: recall a candidate pool near the
// caller, embed the intent, cosine-rank the catalog, return the top cards.
// Reused both as a tool AND to seed the loop RAG-first. Deliberately does NOT
// lazy-embed/persist (unlike the swipe recommender) — Memo never writes.
//
// `opts.traceKind === "recall"` records the RAG-seed step to ctx.trace (with
// pool size + whether it embedded); the plain tool path is recorded generically
// by the airlock's dispatch, so we don't double-record there.
export async function lineupRecall(
  ctx: AirlockContext,
  intent: string,
  opts?: { traceKind?: "recall" },
): Promise<ToolResult> {
  const start = Date.now();
  const pool = await fetchCandidatePool<PlaceRow>(ctx.admin, {
    lat: ctx.lat,
    lng: ctx.lng,
    radiusKm: RECALL_RADIUS_KM,
    poolSize: RECALL_POOL,
  });
  const recordRecall = (
    top: PlaceRow[],
    poolSize: number,
    embedded: boolean,
  ) => {
    if (opts?.traceKind !== "recall" || !ctx.trace) return;
    ctx.trace.push({
      kind: "recall",
      title: "Lineup recall · RAG seed",
      source: "Lineup engine",
      intent,
      poolSize,
      embedded,
      cards: top.map((r) => ({
        name: r.name,
        rating: num((r as Record<string, unknown>).google_stars_overall),
      })),
      ms: Date.now() - start,
    });
  };

  if (!pool.ok || pool.rows.length === 0) {
    recordRecall([], 0, false);
    return { text: "No Mesita places matched near there yet." };
  }
  let ranked = pool.rows;
  let embedded = false;
  if (ctx.keys.openai && intent.trim().length > 0) {
    try {
      const vec = await embedSingle(intent, ctx.keys.openai);
      ranked = rankByCosine(pool.rows, vec);
      embedded = true;
    } catch (e) {
      console.error("[lineup] embed:", (e as Error).message);
    }
  }
  const top = ranked.slice(0, TOOL_CARDS);
  recordRecall(top, pool.rows.length, embedded);
  return {
    text: `Mesita's lineup for this ask (public catalog):\n${placesToText(top)}`,
    predictions: top.map(rowToPrediction),
  };
}

// ── The three tools ────────────────────────────────────────────────────

const webSearchTool: AirlockTool = {
  name: "web_search",
  description:
    "Search the live web for facts, news, what-to-order, vibe, or anything you're unsure about. Returns a grounded summary with sources. Use for general knowledge and current info — NOT for finding Mesita places (use lineup_recommend for that).",
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
      { model: PERPLEXITY_MODEL, maxTokens: 500, temperature: 0.2, returnRelated: true },
    );
    if (!res) return { text: "Couldn't reach the web just now." };
    return { text: res.text, citations: res.citations, related: res.related };
  },
};

const lineupTool: AirlockTool = {
  name: "lineup_recommend",
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
    return lineupRecall(ctx, String(args.intent ?? ""));
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
    const { data, error } = await ctx.admin
      .from("projects_view")
      .select(PLACE_PUBLIC_SELECT)
      .ilike("name", `%${escapeIlike(name)}%`)
      .in("status", ["active", "lead"])
      .limit(TOOL_CARDS);
    if (error) {
      console.error("[place_facts]", error.message);
      return { text: "Couldn't look that up right now." };
    }
    const rows = (data ?? []) as unknown as PlaceRow[];
    if (rows.length === 0) return { text: `No Mesita place named "${name}" found.` };
    return { text: placesToText(rows), predictions: rows.map(rowToPrediction) };
  },
};

// The fixed registry. Adding a capability means adding a READ tool here — there
// is intentionally no write/reserve/edit/delete tool to add.
export function buildMemoTools(): AirlockTool[] {
  return [lineupTool, webSearchTool, placeFactsTool];
}
