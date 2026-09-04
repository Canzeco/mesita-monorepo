// Supabase Edge Function — business-web-suggest-promo
//
// Naming: caller-verb-words. Caller = business, verb = suggest, words = promo.
//
// MESITA-892: advisory "next promo" copilot on business Performance.
// Memo-backed = uses Memo Config's OpenAI model (via supabase-edgefunc-get-memo-config)
// and a calm Memo-adjacent voice. It does NOT run the consumer airlock / RAG
// tools — those are place-seeking for guests. This EF is place-scoped ops advice.
//
// Hard constraints:
//   1. Membership-scoped (requireMembership) — never advise on a competitor.
//   2. NEVER select or mention consumer class / entry door (blended-rate privacy).
//   3. Read-only — suggestions do not write rates. Place still sets Promos.
//
// Body:     { placeId: string, query?: string }
// Response: { ok: true, answer, suggestions[], model, source }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { createMemoData } from "../_shared/memo-data.ts";
import { DEFAULT_MODELS_CONFIG, loadModelsConfig } from "../_shared/models-config.ts";
import { CLOSED_TICKET_STATUS } from "../_shared/ticket-status.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
/** Fallback when models_config.supabase.model is unset. */
const DEFAULT_MODEL = DEFAULT_MODELS_CONFIG.supabase.model!;
const CLOSED_STATUS = CLOSED_TICKET_STATUS;
const REVIEW_SNIPPET_LIMIT = 5;

const STRATEGIES = [
  {
    id: "zero",
    label: "Zero",
    rates: "all rates off",
  },
  {
    id: "conservative",
    label: "Conservative",
    rates: "Welcome 20/30 · Returning 10/20",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    rates: "Welcome 30/50 · Returning 10/30",
  },
  {
    id: "dominant",
    label: "Dominant",
    rates: "Welcome 40/50 · Returning 20/30",
  },
] as const;

type StrategyId = (typeof STRATEGIES)[number]["id"];
const STRATEGY_IDS = new Set<string>(STRATEGIES.map((s) => s.id));

type Focus =
  | "rates"
  | "welcome"
  | "story"
  | "review"
  | "visibility"
  | "retention";

const FOCUSES = new Set<string>([
  "rates",
  "welcome",
  "story",
  "review",
  "visibility",
  "retention",
]);

type Body = {
  placeId?: string;
  projectId?: string;
  query?: string;
};

type PlaceRow = {
  id: string;
  name: string | null;
  category: string | null;
  category_label: string | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
};

type Suggestion = {
  headline: string;
  rationale: string;
  strategyId: StrategyId | null;
  focus: Focus;
};

type PerfContext = {
  placeName: string;
  category: string | null;
  rates: {
    welcomeStd: number | null;
    welcomePrem: number | null;
    returnStd: number | null;
    returnPrem: number | null;
    cap: number | null;
  };
  funnel: {
    saved: number;
    ticketsOpened: number;
    visits: number;
    honored: number;
  };
  byAction: { welcome: number; story: number; review: number };
  content: {
    storiesPosted: number;
    googleReviews: number;
    mesitaReviews: number;
  };
  reviewSnippets: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  const query = typeof bodyRes.body.query === "string"
    ? bodyRes.body.query.trim().slice(0, 400)
    : "";

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  const ctxRes = await loadPerfContext(admin, projectId);
  if (!ctxRes.ok) return json({ ok: false, error: ctxRes.error }, 500);

  // models_config.supabase.model (Models page) with Memo Config fallback.
  // This EF owns place reads itself — Memo's airlock never gets a service-role client.
  const memo = createMemoData(envRes.env, "business-web-suggest-promo");
  const [cfg, models] = await Promise.all([
    memo.config(),
    loadModelsConfig(admin),
  ]);
  const model = models.supabaseModel ||
    (cfg.model && cfg.model.trim()) ||
    DEFAULT_MODEL;
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();

  let suggestions: Suggestion[] = [];
  let answer = "";
  let source: "memo" | "fallback" = "fallback";

  if (openaiKey) {
    const ai = await askMemoPromo(openaiKey, model, ctxRes.ctx, query);
    if (ai) {
      suggestions = ai.suggestions;
      answer = ai.answer;
      source = "memo";
    }
  }

  if (suggestions.length === 0) {
    const fb = fallbackSuggestions(ctxRes.ctx);
    suggestions = fb.suggestions;
    answer = answer || fb.answer;
    source = "fallback";
  }

  return json({
    ok: true,
    answer,
    suggestions,
    model: source === "memo" ? model : null,
    source,
  });
});

async function loadPerfContext(
  admin: SupabaseClient,
  projectId: string,
): Promise<{ ok: true; ctx: PerfContext } | { ok: false; error: string }> {
  // monthly_promo_cap is a PROJECT column; only the profiles view exposes it
  // alongside the place columns, so reading `places` here 400s the whole row.
  const placeRes = await admin
    .from("profiles")
    .select(
      "id, name, category, category_label, " +
        "welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, " +
        "monthly_promo_cap",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (placeRes.error) return { ok: false, error: placeRes.error.message };
  const place = placeRes.data as PlaceRow | null;
  if (!place) return { ok: false, error: "Place not found" };

  const attested = [
    "self_verified",
    "ai_verified",
    "staff_verified",
    "waiter_verified",
  ] as const;

  const [
    savedRes,
    ticketsRes,
    visitsRes,
    honoredRes,
    storiesRes,
    googleRes,
    mesitaRes,
    closedSample,
    reviewRows,
  ] = await Promise.all([
    admin
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId)
      .not("first_scanned_at", "is", null),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId)
      .eq("status", CLOSED_STATUS),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId)
      .in("story_status", [...attested]),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId)
      .in("review_status", [...attested]),
    admin
      .from("ticket_reviews")
      .select("id", { count: "exact", head: true })
      .eq("place_id", projectId),
    admin
      .from("visit_tickets")
      .select("consumer_id, story_status, review_status")
      .eq("place_id", projectId)
      .eq("status", CLOSED_STATUS)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("ticket_reviews")
      .select("comments, overall")
      .eq("place_id", projectId)
      .order("created_at", { ascending: false })
      .limit(REVIEW_SNIPPET_LIMIT),
  ]);

  for (const r of [
    savedRes,
    ticketsRes,
    visitsRes,
    honoredRes,
    storiesRes,
    googleRes,
    mesitaRes,
    closedSample,
    reviewRows,
  ]) {
    if (r.error) return { ok: false, error: r.error.message };
  }

  type ClosedLite = {
    consumer_id: string;
    story_status: string | null;
    review_status: string | null;
  };
  const closed = (closedSample.data ?? []) as unknown as ClosedLite[];
  const visitsByConsumer = new Map<string, number>();
  for (const t of closed) {
    visitsByConsumer.set(
      t.consumer_id,
      (visitsByConsumer.get(t.consumer_id) ?? 0) + 1,
    );
  }

  const reviewSnippets = (reviewRows.data ?? [])
    .map((r) => {
      const comments = ((r as { comments: string | null }).comments ?? "")
        .trim();
      const overall = (r as { overall: number | null }).overall;
      if (comments) {
        return overall != null
          ? `Overall ${overall}/5 — “${comments.slice(0, 160)}”`
          : `“${comments.slice(0, 160)}”`;
      }
      if (overall != null) return `Overall ${overall}/5 (no comment)`;
      return null;
    })
    .filter((x): x is string => !!x);

  return {
    ok: true,
    ctx: {
      placeName: (place.name ?? "Your place").trim() || "Your place",
      category: place.category_label ?? place.category,
      rates: {
        welcomeStd: place.welcome_free_rate,
        welcomePrem: place.welcome_premium_rate,
        returnStd: place.free_rate,
        returnPrem: place.premium_rate,
        cap: place.monthly_promo_cap,
      },
      funnel: {
        saved: savedRes.count ?? 0,
        ticketsOpened: ticketsRes.count ?? 0,
        visits: visitsRes.count ?? 0,
        honored: honoredRes.count ?? 0,
      },
      // Same action cut as business-web-get-performance — never by class.
      byAction: {
        welcome: closed.filter((t) =>
          (visitsByConsumer.get(t.consumer_id) ?? 0) === 1
        ).length,
        story: closed.filter((t) => isAttested(t.story_status)).length,
        review: closed.filter((t) => isAttested(t.review_status)).length,
      },
      content: {
        storiesPosted: storiesRes.count ?? 0,
        googleReviews: googleRes.count ?? 0,
        mesitaReviews: mesitaRes.count ?? 0,
      },
      reviewSnippets,
    },
  };
}

function isAttested(status: string | null): boolean {
  return status === "self_verified" ||
    status === "ai_verified" ||
    status === "staff_verified" ||
    status === "waiter_verified";
}

async function askMemoPromo(
  openaiKey: string,
  model: string,
  ctx: PerfContext,
  query: string,
): Promise<{ answer: string; suggestions: Suggestion[] } | null> {
  const strategyCatalog = STRATEGIES.map((s) =>
    `- ${s.id}: ${s.label} — ${s.rates}`
  ).join("\n");

  const system =
    "You are Memo advising a Mesita place owner about their NEXT promo move. " +
    "Stay advisory — they set rates on the Promos page; you never claim to have changed anything. " +
    "Mesita Promos v4 uses exactly four strategies (pick strategyId from this set or null):\n" +
    strategyCatalog +
    "\n\nProduct rules you must obey:\n" +
    "- Never mention guest class, Premium vs Standard individuals, income, or entry doors. " +
    "Redemption splits are by ACTION only (first visit / story / Google review).\n" +
    "- Prefer one clear next move over a laundry list.\n" +
    "- If data is thin, say so and suggest a modest strategy rather than inventing metrics.\n" +
    "- Output a SINGLE JSON object: " +
    '{"answer":"2-4 calm sentences","suggestions":[{"headline":"…","rationale":"…","strategyId":"aggressive|null","focus":"rates|welcome|story|review|visibility|retention"}]} ' +
    "Return 1–3 suggestions. English only.";

  const user =
    `Place: ${ctx.placeName}` +
    (ctx.category ? ` (${ctx.category})` : "") +
    `\nCurrent rates (Std/Prem): Welcome ${fmtRate(ctx.rates.welcomeStd)}/${fmtRate(ctx.rates.welcomePrem)}, ` +
    `Returning ${fmtRate(ctx.rates.returnStd)}/${fmtRate(ctx.rates.returnPrem)}, ` +
    `cap ${ctx.rates.cap ?? "none"}` +
    `\nFunnel: saved ${ctx.funnel.saved} → tickets ${ctx.funnel.ticketsOpened} → QR ${ctx.funnel.visits} → closed ${ctx.funnel.honored}` +
    `\nBy action (closed): first visits ${ctx.byAction.welcome}, with story ${ctx.byAction.story}, with Google review ${ctx.byAction.review}` +
    `\nGuest-produced: IG stories ${ctx.content.storiesPosted}, Google reviews ${ctx.content.googleReviews}, Mesita reviews ${ctx.content.mesitaReviews}` +
    (ctx.reviewSnippets.length
      ? `\nRecent Mesita review notes:\n- ${ctx.reviewSnippets.join("\n- ")}`
      : "\nNo Mesita review comments yet.") +
    (query
      ? `\n\nOwner question: ${query}`
      : "\n\nOwner question: What should I change next on Promos?");

  try {
    const r = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      console.error("[suggest-promo] openai status", r.status);
      return null;
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    return parseAiJson(raw);
  } catch (e) {
    console.error("[suggest-promo] openai failed:", (e as Error).message);
    return null;
  }
}

function parseAiJson(
  raw: string,
): { answer: string; suggestions: Suggestion[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  const list = Array.isArray(obj.suggestions) ? obj.suggestions : [];
  const suggestions: Suggestion[] = [];
  for (const item of list.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const headline = typeof row.headline === "string"
      ? row.headline.trim().slice(0, 120)
      : "";
    const rationale = typeof row.rationale === "string"
      ? row.rationale.trim().slice(0, 400)
      : "";
    if (!headline || !rationale) continue;
    const sidRaw = typeof row.strategyId === "string"
      ? row.strategyId.trim()
      : null;
    const strategyId =
      sidRaw && STRATEGY_IDS.has(sidRaw) ? sidRaw as StrategyId : null;
    const focusRaw = typeof row.focus === "string" ? row.focus.trim() : "rates";
    const focus = (FOCUSES.has(focusRaw) ? focusRaw : "rates") as Focus;
    suggestions.push({ headline, rationale, strategyId, focus });
  }
  if (!answer && suggestions.length === 0) return null;
  return {
    answer: answer ||
      "Here is a focused next move based on your Performance record.",
    suggestions,
  };
}

function fallbackSuggestions(
  ctx: PerfContext,
): { answer: string; suggestions: Suggestion[] } {
  const ratesOn = [
    ctx.rates.welcomeStd,
    ctx.rates.welcomePrem,
    ctx.rates.returnStd,
    ctx.rates.returnPrem,
  ].some((v) => typeof v === "number" && v > 0);

  const suggestions: Suggestion[] = [];

  if (!ratesOn) {
    suggestions.push({
      headline: "Turn on Conservative to start",
      rationale:
        "You're listed with every rate off. Conservative is the calm first rung — Welcome guests get a real reason to walk in without a maxed-out margin hit.",
      strategyId: "conservative",
      focus: "rates",
    });
  } else if (ctx.funnel.saved > 0 && ctx.funnel.ticketsOpened / ctx.funnel.saved < 0.25) {
    suggestions.push({
      headline: "Sharpen the Welcome deal",
      rationale:
        `Guests are saving you (${ctx.funnel.saved}) but few open a ticket (${ctx.funnel.ticketsOpened}). A stronger Welcome row usually converts saves better than raising Returning.`,
      strategyId: "aggressive",
      focus: "welcome",
    });
  } else if (
    ctx.byAction.welcome > 0 &&
    ctx.byAction.story / ctx.byAction.welcome < 0.2
  ) {
    suggestions.push({
      headline: "Lean into story-backed visits",
      rationale:
        "Closed visits rarely include an Instagram story. Keep rates, and on Promos emphasize the story path so guests know the content ask is part of the deal.",
      strategyId: null,
      focus: "story",
    });
  } else if (
    ctx.byAction.welcome > 0 &&
    ctx.byAction.review / ctx.byAction.welcome < 0.15
  ) {
    suggestions.push({
      headline: "Ask for Google reviews at the table",
      rationale:
        "Few closed visits include a Google review. A clearer review ask (without changing class mix) usually lifts reputation faster than another rate bump.",
      strategyId: null,
      focus: "review",
    });
  } else {
    suggestions.push({
      headline: ratesOn ? "Hold rates; watch the funnel" : "Start with Conservative",
      rationale: ratesOn
        ? "Your record looks balanced enough that a rate jump may not be the lever. Refresh Performance before climbing to Aggressive."
        : "Pick Conservative on Promos so Welcome guests see a real offer.",
      strategyId: ratesOn ? null : "conservative",
      focus: ratesOn ? "retention" : "rates",
    });
  }

  return {
    answer:
      "A quick read of your Performance record — open Promos to apply any rate change.",
    suggestions,
  };
}

function fmtRate(v: number | null): string {
  return v == null ? "off" : `${v}%`;
}
