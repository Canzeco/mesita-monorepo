"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { AI_SUGGESTIONS } from "@/lib/consumer-data";

export default function AiPage() {
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <div className="bg-peacock shadow-glow mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl">
          🦚
        </div>
        <h1 className="font-display mt-5 text-center text-3xl font-semibold tracking-tight">
          What are you in the mood for?
        </h1>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
          Tell me the plan — vibe, area, budget —
          <br />
          and I&apos;ll find the spot.
        </p>

        <p className="bg-secondary/10 text-secondary mx-auto mt-4 max-w-xs rounded-xl px-3 py-2 text-center text-[11px]">
          Preview — Mesita AI isn&apos;t live yet. Tap a suggestion to see what
          it&apos;ll feel like.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {AI_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-5 py-3.5 text-left text-sm transition"
            >
              {s}
            </button>
          ))}
        </div>

        {notice && (
          <p className="bg-muted text-muted-foreground mx-auto mt-4 max-w-xs rounded-xl px-3 py-2 text-center text-[11px]">
            {notice}
          </p>
        )}
      </div>

      <div className="border-border bg-background shrink-0 border-t px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(
              "Coming soon — for now use Swipe or Catalog to find venues, or the Map tab to see what's nearby.",
            );
          }}
          className="border-border bg-card flex items-center gap-2 rounded-full border px-4 py-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-foreground/10 text-foreground flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
