"use client";

// Ask AI — the Memo concierge chat. Lives as a full tab on Home (inline
// layout); the "overlay" layout is retained for any floating-panel host.
//
// Every turn calls Memo (consumer-web-ask-memo), Mesita's AI concierge agent:
// Perplexity (sonar-pro, web-grounded) writes the natural-language reply while
// Google Places + the Mesita catalog resolve the places it names. Ask AI shows
// no place cards — the suggestions are woven into the prose as underlined,
// tappable links (MemoAnswerText): on-Mesita names open the detail modal,
// not-yet-listed ones fire the real consumer-web-create-place Add flow. Prior
// turns are sent as history so Memo can follow up.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import type { MemoAnswer, MemoTurn } from "@/lib/api/memo";
import { cn } from "@/lib/utils";
import type { AddState } from "./PredictionRow";
import { MemoAnswerText } from "./MemoAnswerText";

// Ask AI has no place cards — Memo's suggestions live inline in the prose as
// underlined links (see MemoAnswerText). Each AI turn carries the predictions
// its answer refers to so the names can be linkified.
type AiMessage = {
  id: string;
  role: "user" | "ai";
  kind: "text";
  text: string;
  predictions?: PlacePrediction[];
};

const GREETING =
  "Hola ✨ I'm Memo, your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.";

const AI_ERROR =
  "Hmm, my line dropped for a second — give it another try in a moment.";

// Cap how many cards one reply drops into the thread — a tight, curated
// shortlist reads like a recommendation, not search results.
const MAX_CARDS = 3;
// Cap the follow-up chips Memo suggests under a reply.
const MAX_RELATED = 3;

let nextId = 0;
function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

// Thread persistence — the Ask AI tab is a route now, so switching Home tabs
// unmounts it. Keep the conversation in a module-level cache so it survives
// remounts within the session. Writes happen only on the client (in a save
// effect / event handlers), so the server module stays null across requests
// and the first render always matches SSR (greeting) — no hydration mismatch,
// and no set-state-in-effect. Intentionally NOT localStorage: a full reload
// starts fresh, which keeps this clean and avoids a client-only initial read.
type StoredThread = { messages: AiMessage[]; related: string[] };
const THREAD_CAP = 40; // bound the retained history

let threadCache: StoredThread | null = null;

function greetingThread(): AiMessage[] {
  return [{ id: msgId(), role: "ai", kind: "text", text: GREETING }];
}

export function AskAiPanel({
  onClose,
  ask,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
  layout = "overlay",
}: {
  /** Only meaningful in "overlay" layout (renders the floating close button). */
  onClose?: () => void;
  /** Real concierge call (consumer-web-ask-memo) owned by the page. */
  ask: (text: string, history: MemoTurn[]) => Promise<MemoAnswer>;
  addStates: Record<string, AddState>;
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
  /**
   * "overlay" — floating card pinned over the map (legacy Search usage).
   * "inline" — fills its container as a full section (the Home Ask AI tab).
   */
  layout?: "overlay" | "inline";
}) {
  // Lazy init from the session cache (populated by a previous mount this
  // session). Null on a fresh load / SSR → greeting, so hydration matches.
  const [messages, setMessages] = useState<AiMessage[]>(
    () => threadCache?.messages ?? greetingThread(),
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [related, setRelated] = useState<string[]>(
    () => threadCache?.related ?? [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist to the session cache on every change (writes a module var, not
  // state — no set-state-in-effect). A lone greeting resets the cache to fresh.
  useEffect(() => {
    threadCache =
      messages.length > 1
        ? { messages: messages.slice(-THREAD_CAP), related }
        : null;
  }, [messages, related]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, related]);

  const clearThread = () => {
    setMessages(greetingThread());
    setRelated([]);
    setInput("");
    threadCache = null;
  };

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    setRelated([]);

    // Snapshot the prior text turns as history BEFORE appending this one, so
    // Memo can follow up on the conversation.
    const history: MemoTurn[] = messages
      .filter((m): m is Extract<AiMessage, { kind: "text" }> => m.kind === "text")
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

    setMessages((m) => [
      ...m,
      { id: msgId(), role: "user", kind: "text", text },
    ]);
    setThinking(true);
    void (async () => {
      let reply: MemoAnswer | null = null;
      try {
        reply = await ask(text, history);
      } catch {
        reply = null;
      }
      const shown = (reply?.predictions ?? []).slice(0, MAX_CARDS);
      setMessages((m) => [
        ...m,
        {
          id: msgId(),
          role: "ai",
          kind: "text",
          text: reply?.answer?.trim() ? reply.answer : AI_ERROR,
          predictions: shown,
        },
      ]);
      setRelated((reply?.related ?? []).slice(0, MAX_RELATED));
      setThinking(false);
    })();
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        layout === "overlay"
          ? "border-primary/30 bg-background/95 shadow-elev absolute inset-x-3 top-[68px] z-40 max-h-[88%] min-h-[72%] rounded-2xl border backdrop-blur-xl"
          : "h-full min-h-0",
      )}
    >
      {/* Floating close — overlay only; the inline tab is dismissed via the
          Home mode nav, so it needs no close affordance. */}
      {layout === "overlay" && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask AI"
          className="border-border bg-background/90 text-foreground hover:bg-muted absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Clear the conversation — only once there's more than the greeting.
          Offset left of the overlay close when both are present. */}
      {messages.length > 1 && (
        <button
          type="button"
          onClick={clearThread}
          aria-label="Clear chat"
          className={cn(
            "border-border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-muted absolute top-2 z-10 flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs shadow-sm backdrop-blur-sm transition active:scale-95",
            layout === "overlay" ? "right-12" : "right-2",
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      {/* Thread */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {messages.map((m) => {
          const isUser = m.role === "user";
          const hasPlaces = !isUser && (m.predictions?.length ?? 0) > 0;
          return (
            <div
              key={m.id}
              className={cn("flex", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isUser
                    ? "bg-pink-gradient text-white"
                    : "border-border bg-card border",
                )}
              >
                {hasPlaces ? (
                  <MemoAnswerText
                    text={m.text}
                    predictions={m.predictions ?? []}
                    resolvePlace={resolvePlace}
                    addStates={addStates}
                    onInfo={onInfo}
                    onAdd={onAdd}
                  />
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex justify-start">
            <div className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm">
              <Spinner size="sm" label="Thinking" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Follow-up chips — Memo's suggested next questions */}
      {related.length > 0 && !thinking && (
        <div className="border-border flex flex-wrap gap-1.5 border-t px-3 pt-2">
          {related.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="border-border bg-muted/50 text-foreground hover:bg-muted max-w-full truncate rounded-full border px-3 py-1 text-xs transition active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-border bg-background/80 border-t p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-border bg-card flex items-center gap-2 rounded-2xl border px-3 py-2"
        >
          <Sparkles className="text-primary h-4 w-4 shrink-0" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="bg-pink-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
