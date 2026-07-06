"use client";

// Ask AI — the Search page's concierge chat, powered by Memo.
//
// Every turn calls Memo (consumer-web-ask-memo), Mesita's AI concierge agent:
// Perplexity (sonar-pro, web-grounded) writes the natural-language reply while
// Google Places + the Mesita catalog supply the place cards. Both the prose
// AND the cards are real; the cards reuse the same Info / Add mechanics as text
// search (Add fires the real consumer-web-create-place flow). Prior turns are
// sent as history so Memo can follow up.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import type { MemoAnswer, MemoTurn } from "@/lib/api/memo";
import { cn } from "@/lib/utils";
import { PredictionRow, type AddState } from "./PredictionRow";

type AiMessage =
  | { id: string; role: "user" | "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "place"; prediction: PlacePrediction };

const GREETING =
  "Hola ✨ I'm Memo, your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.";

const AI_ERROR =
  "Hmm, my line dropped for a second — give it another try in a moment.";

// Cap how many cards one reply drops into the thread — a wall of ten
// cards reads like search results, not a recommendation.
const MAX_CARDS = 4;
// Cap the follow-up chips Memo suggests under a reply.
const MAX_RELATED = 3;

let nextId = 0;
function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

export function AskAiPanel({
  onClose,
  ask,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
}: {
  onClose: () => void;
  /** Real concierge call (consumer-web-ask-memo) owned by the page. */
  ask: (text: string, history: MemoTurn[]) => Promise<MemoAnswer>;
  addStates: Record<string, AddState>;
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
}) {
  const [messages, setMessages] = useState<AiMessage[]>([
    { id: msgId(), role: "ai", kind: "text", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [related, setRelated] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, related]);

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
        },
        ...shown.map<AiMessage>((prediction) => ({
          id: msgId(),
          role: "ai",
          kind: "place",
          prediction,
        })),
      ]);
      setRelated((reply?.related ?? []).slice(0, MAX_RELATED));
      setThinking(false);
    })();
  };

  return (
    <div className="border-primary/30 bg-background/95 shadow-elev absolute inset-x-3 top-[68px] z-40 flex max-h-[88%] min-h-[72%] flex-col overflow-hidden rounded-2xl border backdrop-blur-xl">
      {/* Floating close — no header, to save vertical space */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Ask AI"
        className="border-border bg-background/90 text-foreground hover:bg-muted absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {messages.map((m) => {
          if (m.kind === "text") {
            const isUser = m.role === "user";
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
                  {m.text}
                </div>
              </div>
            );
          }
          return (
            <PredictionRow
              key={m.id}
              prediction={m.prediction}
              matchedPlace={resolvePlace(m.prediction)}
              addState={addStates[m.prediction.placeId]}
              onInfo={onInfo}
              onAdd={onAdd}
              compact
            />
          );
        })}
        {thinking && (
          <div className="flex justify-start">
            <div className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm">
              <Spinner size="sm" label="Thinking" />
              Scouting spots…
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
