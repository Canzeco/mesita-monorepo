// Stateless Chat turn — OpenAI chat completions, no tools.
//
// Every consumer message resends the system prompt plus the full thread the
// client already holds. That is the honest first pass (Admin Discovery › Chat
// flags a cheaper ingest as Due). This file does not persist conversation
// state. The only cap is a char fuse so a runaway paste cannot blow the model.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Fuse, not a product cap: drop oldest turns only after this many chars. */
export const CONTEXT_CHAR_BUDGET = 120_000;
/** Fuse on a single turn so one paste cannot eat the whole budget. */
export const TURN_CONTENT_MAX = 32_000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function sanitizeChatHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const role = rec.role === "assistant" || rec.role === "user" ? rec.role : null;
    const content = typeof rec.content === "string" ? rec.content.trim() : "";
    if (!role || content.length === 0) continue;
    out.push({ role, content: content.slice(0, TURN_CONTENT_MAX) });
  }
  let total = 0;
  for (const t of out) total += t.content.length;
  while (out.length > 0 && total > CONTEXT_CHAR_BUDGET) {
    const gone = out.shift();
    if (!gone) break;
    total -= gone.content.length;
  }
  return out;
}

export function buildChatMessages(
  system: string,
  history: ChatTurn[],
  query: string,
): { role: "system" | "user" | "assistant"; content: string }[] {
  return [
    { role: "system", content: system },
    ...history,
    { role: "user", content: query.trim().slice(0, TURN_CONTENT_MAX) },
  ];
}

export async function completeChatTurn(opts: {
  openaiKey: string;
  model: string;
  system: string;
  history: ChatTurn[];
  query: string;
}): Promise<string | null> {
  const key = opts.openaiKey.trim();
  if (!key) return null;
  const model = opts.model.trim();
  if (!model) return null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: buildChatMessages(opts.system, opts.history, opts.query),
      }),
    });
    if (!res.ok) {
      console.error("[memo-openai-turn]", res.status, await res.text());
      return null;
    }
    const body = await res.json() as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
  } catch (e) {
    console.error("[memo-openai-turn]", (e as Error).message);
    return null;
  }
}
