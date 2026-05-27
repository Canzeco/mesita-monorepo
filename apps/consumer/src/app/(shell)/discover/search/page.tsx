"use client";

import { useState } from "react";
import { Search } from "lucide-react";

// Discover sub-route — standard keyword search (la lupa). Sits between
// the no-typing modes (Swipe / Map / Catalog) and the conversational
// AI mode in the Discover strip. Use it for short queries like "sushi",
// "rooftop", "open now"; use AI (Don Memo) for sentences. This page is
// a preview shell until the search EF lands.

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Sample chips that hint at what plain search is for. The phrases stay
  // single-keyword-ish so the contrast with AI ("Don Memo, dónde llevo a
  // mi pareja este viernes a las 9") is unambiguous.
  const examples = [
    "sushi",
    "rooftop",
    "brunch",
    "tacos",
    "Polanco",
    "open now",
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <div className="bg-card-soft ring-border mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-1">
          <Search className="text-foreground h-7 w-7" strokeWidth={2} />
        </div>
        <h1 className="font-display mt-5 text-center text-3xl font-semibold tracking-tight">
          Search
        </h1>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
          Type a name, a neighborhood, a cuisine.
          <br />
          For full sentences, ask{" "}
          <span className="text-foreground font-medium">Don Memo (AI)</span>.
        </p>

        <p className="bg-secondary/10 text-secondary mx-auto mt-4 max-w-xs rounded-xl px-3 py-2 text-center text-[11px]">
          Preview — search isn&apos;t wired to the backend yet.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {examples.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput(q)}
              className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition"
            >
              {q}
            </button>
          ))}
        </div>

        {submitted && (
          <p className="bg-muted text-muted-foreground mx-auto mt-6 max-w-xs rounded-xl px-3 py-2 text-center text-[11px]">
            Got it — &ldquo;{submitted}&rdquo; results land here once the
            search EF ships.
          </p>
        )}
      </div>

      <div className="border-border bg-background shrink-0 border-t px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.trim();
            if (!q) return;
            setSubmitted(q);
          }}
          className="border-border bg-card flex items-center gap-2 rounded-full border px-4 py-2.5"
        >
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search venues..."
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-foreground/10 text-foreground rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50"
            aria-label="Search"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
