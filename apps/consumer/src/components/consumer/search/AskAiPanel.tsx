"use client";

// Ask AI — the Search page's concierge chat.
//
// The conversational layer is mocked for now — there is no concierge EF
// yet — but the place cards it returns are REAL: every user message runs
// through consumer-suggest-places and the matching On Mesita / From
// Google rows render with the same Info / Add mechanics as text search
// (Add fires the real consumer-web-create-place flow).
// TODO(EF): consumer-ask-concierge — replace buildConciergeReply with the
// real chat EF once it exists.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import { cn } from "@/lib/utils";
import { PredictionRow, type AddState } from "./PredictionRow";

type AiMessage =
  | { id: string; role: "user" | "ai"; kind: "text"; text: string }
  | { id: string; role: "ai"; kind: "place"; prediction: PlacePrediction };

const GREETING =
  "Hola ✨ I'm your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.";

// Cap how many cards one reply drops into the thread — a wall of ten
// cards reads like search results, not a recommendation.
const MAX_CARDS = 4;

let nextId = 0;
function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

// TODO(EF): consumer-ask-concierge — mocked reply copy. The counts are
// real (they come from the live suggest call); only the prose is canned.
function buildConciergeReply(
  query: string,
  onMesita: number,
  fromGoogle: number,
): string {
  if (onMesita === 0 && fromGoogle === 0) {
    return `I couldn't find spots matching “${query}” — try a place name, a dish, or a neighborhood.`;
  }
  const parts: string[] = [];
  if (onMesita > 0)
    parts.push(`${onMesita} on Mesita${onMesita > 1 ? "" : ""}`);
  if (fromGoogle > 0) parts.push(`${fromGoogle} from Google`);
  const lead =
    onMesita > 0
      ? "Here's what I'd check out"
      : "Nothing on Mesita yet, but I found these";
  return `${lead} for “${query}” — ${parts.join(" and ")}. Tap Add on a Google spot and I'll build its profile.`;
}

export function AskAiPanel({
  onClose,
  suggest,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
}: {
  onClose: () => void;
  /** Real suggest call (consumer-suggest-places) owned by the page. */
  suggest: (text: string) => Promise<PlacePrediction[]>;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: msgId(), role: "user", kind: "text", text },
    ]);
    setThinking(true);
    void (async () => {
      let predictions: PlacePrediction[] = [];
      let failed = false;
      try {
        predictions = await suggest(text);
      } catch {
        failed = true;
      }
      const shown = predictions.slice(0, MAX_CARDS);
      const onMesita = shown.filter((p) => p.status !== "not_in_mesita").length;
      const fromGoogle = shown.length - onMesita;
      setMessages((m) => [
        ...m,
        {
          id: msgId(),
          role: "ai",
          kind: "text",
          text: failed
            ? "Hmm, my search line dropped — give it another try in a moment."
            : buildConciergeReply(text, onMesita, fromGoogle),
        },
        ...shown.map<AiMessage>((prediction) => ({
          id: msgId(),
          role: "ai",
          kind: "place",
          prediction,
        })),
      ]);
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
