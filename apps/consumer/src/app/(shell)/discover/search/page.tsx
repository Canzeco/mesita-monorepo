"use client";

import { useState } from "react";
import { Search } from "lucide-react";

// /discover/search — plain text search. The most direct lookup tool
// in the Discover strip: type a place name, get matches. Lives between
// Swipe (passive default) and Map (spatial browse) in the friction
// ramp.
//
// "Ask AI" (separate tab at /discover/ai) handles the conversational /
// multi-constraint queries. This route is the keyword-only lane on
// purpose — splitting them gives a dummy user a clear path when they
// just want to type "Mar Verde" and find it. The route used to merge
// into AI Search; the new five-tab Discover strip restores Search as
// its own surface.
//
// Backend wiring lands with the venues search Edge Function; until
// then the input updates local state and shows an empty-results
// state below.

const PLACEHOLDER_SUGGESTIONS = [
  "Mar Verde",
  "Neón Bar",
  "Casa Luminar",
  "Atelier Nueve",
];

export default function DiscoverSearchPage() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  return (
    <div className="scrollbar-hide h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
        <label className="border-border bg-card focus-within:border-foreground/40 flex items-center gap-2 rounded-full border px-4 py-3 transition">
          <Search
            className="text-muted-foreground h-4 w-4 shrink-0"
            strokeWidth={2}
          />
          <input
            type="search"
            inputMode="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places by name"
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
            >
              Clear
            </button>
          )}
        </label>

        {trimmed.length === 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
              Try a place
            </p>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDER_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-3 py-1.5 text-[12px] font-medium transition"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-[11.5px] leading-relaxed">
              Looking for a vibe, a price, or a neighborhood? Try{" "}
              <span className="text-foreground font-semibold">Ask AI</span>{" "}
              instead — it handles full sentences.
            </p>
          </section>
        ) : (
          <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
            Live search lands with the venues Edge Function. For now, try
            Swipe or Catalog to find {`"${trimmed}"`}.
          </div>
        )}
      </div>
    </div>
  );
}
