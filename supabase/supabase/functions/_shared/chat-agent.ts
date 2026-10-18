// THE CHAT AGENT (MESITA-2339): above the pipelines, never beside them.
//
// One guest turn:
//   1. Read the structured intent from the thread, once: a place the guest
//      names, the families they ask for, whether they mean "around me", and
//      the qualitative need in their own words (`extractChatIntent`).
//   2. Invoke the pipelines that intent calls for, in parallel:
//        Name  a named place          → the Name pipeline's Mesita lane
//        Area  families or "near me"  → the Area pipeline, Mesita Selected
//                                       scope, around the guest's location
//        Deep  a qualitative need     → the Deep pipeline (Description)
//      With no usable intent, Deep runs on the guest's message: the
//      behaviour before this agent existed.
//   3. Merge fairly (round-robin across the pipelines that ran, so none is
//      starved), dedupe by place id (the first pipeline to find a place
//      keeps it, and borrows a later copy's About or distance), stop at the
//      operator's "Places handed to Chat" (`deep.limit`), and hand the model
//      one list grouped by WHY each place is on it.
//
// The agent calls pipelines through `ChatPipelines`; it holds no database
// client and never calls a source (Google, Mesita's tables, embeddings).
// Chat names only Mesita places, so neither Name nor Area spends a Google
// call here. Every step fails soft: a failed intent read falls back to
// Deep, a failed pipeline contributes nothing. Nothing here writes.

import { CATALOG_FAMILIES, CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import { OPENAI_URL } from "./enrich-config.ts";
import { familyGate } from "./area-score.ts";
import type { ChatTurn } from "./memo-openai-turn.ts";

export type ChatIntent = {
  /** A specific place the guest names, as they wrote it. */
  placeName: string | null;
  /** Guest families they ask for (the fifteen catalog slugs). */
  families: string[];
  /** They mean around themselves ("near me", "close by", "por aquí"). */
  nearby: boolean;
  /** The qualitative need in their words ("quiet, good for a first date"). */
  qualitative: string | null;
};

export const NO_INTENT: ChatIntent = { placeName: null, families: [], nearby: false, qualitative: null };

export type ChatPipelineKey = "name" | "area" | "deep";

/** One place a pipeline handed the agent, with the reason it is there. */
export type ChatPlace = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  familyKeys: string[];
  rating: number | null;
  reviewCount: number | null;
  /** The place's About, trimmed: the evidence the model may quote. */
  about: string | null;
  distanceKm: number | null;
  why: ChatPipelineKey;
};

/** The pipelines the agent may call. Production wiring lives in the EF. */
export type ChatPipelines = {
  name: (placeName: string) => Promise<ChatPlace[]>;
  area: (families: string[]) => Promise<ChatPlace[]>;
  deep: (text: string) => Promise<ChatPlace[]>;
  /** True when the guest shared a location (Area has an anchor). */
  hasAnchor: boolean;
};

export type ChatAgentResult = {
  intent: ChatIntent;
  /** Which pipelines ran this turn, in merge order. */
  invoked: ChatPipelineKey[];
  places: ChatPlace[];
};

const TEXT_MAX = 200;
/** The intent read is optional: past this it is abandoned for Deep. */
const INTENT_TIMEOUT_MS = 4000;

const FAMILY_SET = new Set<string>(CATALOG_FAMILY_SLUGS);

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, TEXT_MAX);
  return t.length >= 2 ? t : null;
}

/** Validates whatever the model returned into a ChatIntent: unknown
 *  families drop, strings are trimmed and capped, anything else is empty. */
export function parseChatIntent(raw: unknown): ChatIntent {
  if (!raw || typeof raw !== "object") return NO_INTENT;
  const r = raw as Record<string, unknown>;
  const families = Array.isArray(r.families)
    ? [...new Set(r.families.filter((f): f is string => typeof f === "string" && FAMILY_SET.has(f)))]
    : [];
  return {
    placeName: cleanText(r.placeName),
    families,
    nearby: r.nearby === true,
    qualitative: cleanText(r.qualitative),
  };
}

/** Which pipelines an intent calls for. Deep also runs when nothing else
 *  would, on the guest's own message. */
export function planChatTurn(intent: ChatIntent, hasAnchor: boolean): ChatPipelineKey[] {
  const plan: ChatPipelineKey[] = [];
  if (intent.placeName) plan.push("name");
  if (intent.families.length > 0 || (intent.nearby && hasAnchor)) plan.push("area");
  if (intent.qualitative || plan.length === 0) plan.push("deep");
  return plan;
}

async function soft(p: Promise<ChatPlace[]>, label: string): Promise<ChatPlace[]> {
  try {
    return await p;
  } catch (err) {
    console.error(`[chat-agent] ${label}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Round-robin across lists, so the last pipeline is never the one cut. */
function interleave(lists: ChatPlace[][]): ChatPlace[] {
  const out: ChatPlace[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

/** Dedupe by id: the first copy wins and borrows what a later one knows. */
function mergeUnique(places: ChatPlace[]): ChatPlace[] {
  const byId = new Map<string, ChatPlace>();
  for (const p of places) {
    if (!p.id) continue;
    const kept = byId.get(p.id);
    if (!kept) {
      byId.set(p.id, { ...p });
      continue;
    }
    if (kept.about === null && p.about !== null) kept.about = p.about;
    if (kept.distanceKm === null && p.distanceKm !== null) kept.distanceKm = p.distanceKm;
  }
  return [...byId.values()];
}

export async function runChatAgent(
  query: string,
  extractIntent: () => Promise<ChatIntent | null>,
  pipelines: ChatPipelines,
  limit: number,
): Promise<ChatAgentResult> {
  const cap = Math.max(1, Math.floor(limit));
  let intent: ChatIntent | null = null;
  try {
    intent = await extractIntent();
  } catch (err) {
    console.error("[chat-agent] intent:", err instanceof Error ? err.message : err);
  }
  if (!intent) {
    // The intent read failed: Deep on the guest's message, as before.
    const places = await soft(pipelines.deep(query), "deep");
    return { intent: NO_INTENT, invoked: ["deep"], places: mergeUnique(places).slice(0, cap) };
  }

  const plan = planChatTurn(intent, pipelines.hasAnchor);
  const families = intent.families;
  const results = await Promise.all(plan.map((key) => {
    if (key === "name") return soft(pipelines.name(intent!.placeName!), "name");
    if (key === "area") return soft(pipelines.area(families), "area");
    // Deep embeds the guest's whole message, so the kind of place they named
    // shapes the meaning, and the Family gate applies when they asked for
    // one: a café never answers "sushi barato" as a fit.
    return soft(pipelines.deep(query), "deep").then((list) =>
      families.length === 0 ? list : list.filter((p) => familyGate(p.familyKeys, families) === 1)
    );
  }));

  return { intent, invoked: plan, places: mergeUnique(interleave(results)).slice(0, cap) };
}

const HEADINGS: Record<ChatPipelineKey, string> = {
  name: "Mesita places matching the name the guest gave (the Name pipeline):",
  area: "Mesita Selected places around the guest, nearest and best loved first (the Area pipeline):",
  deep: "Mesita places whose own description may fit what the guest asked for (the Deep pipeline):",
};
/** Area without a location ranks on Popularity alone, anywhere. */
const AREA_NO_ANCHOR =
  "Mesita Selected places of the kind the guest asked for, best loved first; the guest shared no location, so these may be anywhere (the Area pipeline):";

/**
 * The agent's answer as context for the Chat model: the places grouped by
 * why they are there, with their facts and About. The model may recommend a
 * Mesita place only from this list; it advises and writes nothing.
 */
const FAMILY_LABEL = new Map<string, string>(CATALOG_FAMILIES.map((f) => [f.slug, f.label]));

export function chatContextForModel(
  places: readonly ChatPlace[],
  opts: { hasAnchor: boolean },
): string {
  if (places.length === 0) return "";
  const label = (k: string) => FAMILY_LABEL.get(k) ?? k;
  const lines = [
    "Mesita looked these places up for this turn; you did not. When you recommend a Mesita place, choose from this list; never invent one.",
  ];
  let n = 0;
  for (const key of ["name", "area", "deep"] as const) {
    const group = places.filter((p) => p.why === key);
    if (group.length === 0) continue;
    lines.push(key === "area" && !opts.hasAnchor ? AREA_NO_ANCHOR : HEADINGS[key]);
    for (const p of group) {
      n += 1;
      const kinds = p.familyKeys.filter((f) => f && f !== "undefined").map(label);
      const facts = [
        kinds.length > 0 ? kinds.join(", ") : null,
        p.address,
        p.rating !== null ? `${p.rating}★${p.reviewCount !== null ? ` (${p.reviewCount} reviews)` : ""}` : null,
        p.distanceKm !== null ? `${p.distanceKm} km away` : null,
      ].filter(Boolean).join(" · ");
      lines.push(`${n}. ${p.name}${facts ? ` — ${facts}` : ""}${p.about ? `\n   ${p.about}` : ""}`);
    }
  }
  return lines.join("\n");
}

const INTENT_SCHEMA = {
  name: "chat_intent",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["placeName", "families", "nearby", "qualitative"],
    properties: {
      placeName: {
        type: ["string", "null"],
        description: "A specific place the guest names (a restaurant, bar or cafe name), as written; null if none.",
      },
      families: {
        type: "array",
        items: { type: "string", enum: [...CATALOG_FAMILY_SLUGS] },
        description: "The kinds of place the guest asks for, from the allowed list; empty if none.",
      },
      nearby: {
        type: "boolean",
        description: "True when the guest means places around themselves (near me, close by, around here, por aquí, cerca).",
      },
      qualitative: {
        type: ["string", "null"],
        description: "The qualities they want, in their own words (vibe, occasion, budget, atmosphere); null if none.",
      },
    },
  },
} as const;

const INTENT_INSTRUCTIONS =
  "You read a guest's latest message, in the context of the conversation, and return what they are looking for. Fill only what the guest actually said or clearly meant; never guess a place name. Families: coffee, breakfast, quick_bite, pizza, tacos, sushi, burgers, noodles, dinner, sweet, drinks, night_out, go_out, move, feel_better.";

/** One structured-output call: the guest's intent for this turn, or null
 *  when it cannot be read (no key, no model, an error). */
export async function extractChatIntent(opts: {
  openaiKey: string;
  model: string;
  query: string;
  history: ChatTurn[];
  fetchImpl?: typeof fetch;
}): Promise<ChatIntent | null> {
  const key = opts.openaiKey.trim();
  const model = opts.model.trim();
  if (!key || !model) return null;
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(OPENAI_URL, {
      method: "POST",
      signal: AbortSignal.timeout(INTENT_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: INTENT_SCHEMA },
        messages: [
          { role: "system", content: INTENT_INSTRUCTIONS },
          ...opts.history.slice(-6),
          { role: "user", content: opts.query.slice(0, 2000) },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[chat-agent] intent:", res.status, await res.text());
      return null;
    }
    const body = await res.json() as { choices?: { message?: { content?: unknown } }[] };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    return parseChatIntent(JSON.parse(text));
  } catch (err) {
    console.error("[chat-agent] intent:", err instanceof Error ? err.message : err);
    return null;
  }
}
