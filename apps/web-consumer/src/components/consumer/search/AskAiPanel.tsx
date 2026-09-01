"use client";

import { Z_IN_FRAME_OVERLAY } from "@/lib/z-index";

// Ask AI — the Memo concierge chat. Lives as a full tab on Home (inline
// layout); the "overlay" layout is retained for any floating-panel host.
//
// Every turn calls Memo (consumer-web-ask-memo). The client resends the full
// thread as history — no server-side memory. Place cards stay in the reply
// shape for later tools; this pass is conversation only.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Phone, RotateCcw, Sparkles, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";
import type { MemoAnswer, MemoTurn } from "@/lib/api/memo";
import { cn } from "@/lib/utils";
import type { AddState } from "./add-state";
import { MemoAnswerText } from "./MemoAnswerText";
import {
  buildAiReply,
  buildMemoHistory,
  clearThreadCache,
  getThreadCache,
  greetingThread,
  msgId,
  saveThreadCache,
  setConfiguredGreeting,
  withServerGreeting,
  type AiMessage,
} from "./ask-ai-thread";

export function AskAiPanel({
  onClose,
  ask,
  loadGreeting,
  addStates,
  resolvePlace,
  onInfo,
  onAdd,
  onCall,
  layout = "overlay",
}: {
  /** Only meaningful in "overlay" layout (renders the floating close button). */
  onClose?: () => void;
  /** Real concierge call (consumer-web-ask-memo) owned by the page. */
  ask: (text: string, history: MemoTurn[]) => Promise<MemoAnswer>;
  /** Empty-query ask-memo bootstrap for the configured opener. */
  loadGreeting?: () => Promise<string | null>;
  addStates: Record<string, AddState>;
  resolvePlace: (prediction: PlacePrediction) => Place | null;
  onInfo: (prediction: PlacePrediction) => void;
  onAdd: (prediction: PlacePrediction) => void;
  /**
   * Start a voice call with Memo. When present, a Call button sits in the
   * COMPOSER, immediately left of Send — the slot a messaging app gives its
   * voice affordance. Omit it and the composer is text-only, which is what the
   * map's overlay usage wants.
   */
  onCall?: () => void;
  /**
   * "overlay" — floating card pinned over the map (legacy Search usage).
   * "inline" — fills its container as a full section (the Home Ask AI tab).
   */
  layout?: "overlay" | "inline";
}) {
  // Lazy init from the session cache (populated by a previous mount this
  // session). Null on a fresh load / SSR → greeting, so hydration matches.
  const [messages, setMessages] = useState<AiMessage[]>(
    () => getThreadCache()?.messages ?? greetingThread(),
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [related, setRelated] = useState<string[]>(
    () => getThreadCache()?.related ?? [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist to the session cache on every change (writes a module var, not
  // state — no set-state-in-effect). A lone greeting resets the cache to fresh.
  useEffect(() => {
    saveThreadCache(messages, related);
  }, [messages, related]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, related]);

  // Pull memo greeting from ask-memo bootstrap; keep FALLBACK on failure.
  useEffect(() => {
    if (!loadGreeting) return;
    let cancelled = false;
    void (async () => {
      try {
        const greeting = await loadGreeting();
        if (cancelled || !greeting) return;
        setConfiguredGreeting(greeting);
        setMessages((m) => withServerGreeting(m));
      } catch {
        // Keep the in-code English fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGreeting]);

  const clearThread = () => {
    setMessages(greetingThread());
    setRelated([]);
    setInput("");
    clearThreadCache();
  };

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    setRelated([]);

    // Snapshot the prior text turns as history BEFORE appending this one, so
    // Memo can follow up on the conversation.
    const history = buildMemoHistory(messages);

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
      const aiReply = buildAiReply(reply);
      setMessages((m) => [...m, aiReply.message]);
      setRelated(aiReply.related);
      setThinking(false);
    })();
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        layout === "overlay"
          ? cn(
              "border-primary/30 bg-background/95 shadow-elev absolute inset-x-3 top-[68px] max-h-[88%] min-h-[72%] rounded-2xl border backdrop-blur-xl",
              Z_IN_FRAME_OVERLAY,
            )
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
          className="border-border bg-background/90 text-foreground hover:bg-muted shadow-rest absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-95"
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
            "border-border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-muted shadow-rest absolute top-2 z-10 flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs backdrop-blur-sm transition active:scale-95",
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
          {/* CALL SITS HERE, not in a header (Pato, 2026-09-01). Voice and text
              are the same act — say the thing — so the control belongs beside
              the other way of saying it, in the slot every messaging app puts
              its mic in. As a header segment pair it read as a mode switch and
              cost the thread 60px of pinned chrome before a word was typed.

              NOT the `Button` primitive: that ships exactly one variant, the
              pink CTA, and two pink circles in one composer compete for the
              same tap. Muted sibling, same size-8 circle, so Send stays the
              loudest thing in the row. */}
          {onCall && (
            <button
              type="button"
              onClick={onCall}
              aria-haspopup="dialog"
              aria-label="Call Don Memo"
              className="bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground grid size-8 shrink-0 place-items-center rounded-full transition active:scale-95"
            >
              <Phone className="h-4 w-4" />
            </button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="shrink-0 active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
