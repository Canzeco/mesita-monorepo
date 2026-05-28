"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Crown,
  Loader2,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiSuggestPlaces,
  type PlacePrediction,
  type PlacePredictionStatus,
} from "@/lib/api/venues";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// /discover/search — plain text search with Google Places + Mesita
// merge. Mirrors the business /add page picker exactly: hits the
// consumer-suggest-places EF (natural caller) which forwards to
// atlas-suggest-venue, returning every match labelled with one of
// four statuses. Consumer-side deliberately surfaces "Not on Mesita"
// rows so people can confirm a spot exists even before it onboards
// — the empty-state nudges them to ask us to invite the place.
//
// Debounced at 220ms to match the business surface, with an opaque
// session token so Google bills the autocomplete + details flow as
// one request (cheaper) when the row is eventually tapped.

const SEARCH_DEBOUNCE_MS = 220;

function newSessionToken(): string {
  // Cheap UUID-ish token. Crypto.randomUUID is fine on every browser
  // we ship to; the token only needs to be unique per session, not
  // unguessable.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DiscoverSearchPage() {
  const supabase = useBrowserSupabase();
  const sessionTokenRef = useRef(newSessionToken());

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  // Debounced autocomplete — fires on every keystroke past the
  // 2-char threshold. Cancellable via the cancelled flag so an
  // older response can't clobber a newer query's state.
  useEffect(() => {
    if (trimmed.length < 2) {
      setPredictions([]);
      setSearching(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const results = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (!cancelled) setPredictions(results);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed.");
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, supabase]);

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
          {searching && (
            <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
          )}
          {!searching && trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
            >
              Clear
            </button>
          )}
        </label>

        {error && (
          <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[12.5px]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {trimmed.length === 0 && <ResultsEmptyPrompt />}

        {trimmed.length > 0 &&
          !searching &&
          !error &&
          predictions.length === 0 && <NoMatches query={trimmed} />}

        {predictions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <PredictionRow prediction={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Initial state (no query). Suggest some seed names + tell the user
// Ask AI is the right surface for full sentences.
function ResultsEmptyPrompt() {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        Try a place
      </p>
      <div className="flex flex-wrap gap-2">
        {["Mar Verde", "Neón Bar", "Casa Luminar", "Atelier Nueve"].map((s) => (
          <SeedChip key={s} label={s} />
        ))}
      </div>
      <p className="text-muted-foreground text-[11.5px] leading-relaxed">
        Looking for a vibe, a price, or a neighborhood? Try{" "}
        <Link
          href="/discover/ai"
          className="text-foreground font-semibold hover:underline"
        >
          Ask AI
        </Link>{" "}
        instead — it handles full sentences.
      </p>
    </section>
  );
}

// Renders a tappable suggestion chip that fills the input.
function SeedChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        // Dispatch a real input event so the controlled <input> picks
        // it up without us having to lift state higher.
        const input = document.querySelector<HTMLInputElement>(
          "input[type='search']",
        );
        if (!input) return;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, label);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }}
      className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-3 py-1.5 text-[12px] font-medium transition"
    >
      {label}
    </button>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-[12.5px] leading-relaxed">
      No matches for <span className="text-foreground font-semibold">&ldquo;{query}&rdquo;</span>.
      <br />
      Try a different spelling, drop the city qualifier, or paste the venue&apos;s
      Google name.
    </div>
  );
}

// Per-status meta. Reach into the same vocabulary the business picker
// uses but the badge copy is consumer-facing — businesses get "Verified
// partner / Web listed / You own this", consumers get "On Mesita /
// Unclaimed / Not on Mesita yet / You own this".
type Meta = {
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
};

const STATUS_META: Record<PlacePredictionStatus, Meta> = {
  not_in_mesita: {
    label: "Not on Mesita yet",
    Icon: MapPin,
    iconClass: "bg-muted text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
  web_listed: {
    label: "Unclaimed",
    Icon: Bookmark,
    iconClass: "bg-secondary/15 text-secondary",
    badgeClass: "bg-secondary/15 text-secondary",
  },
  verified_partner_other: {
    label: "On Mesita",
    Icon: CheckCircle2,
    iconClass: "bg-pink-500/15 text-pink-600",
    badgeClass: "bg-pink-500/15 text-pink-600",
  },
  verified_partner_self: {
    label: "You own this",
    Icon: Crown,
    iconClass: "bg-pink-gradient text-white",
    badgeClass: "bg-pink-gradient text-white",
  },
};

function PredictionRow({ prediction }: { prediction: PlacePrediction }) {
  const meta = STATUS_META[prediction.status];
  // Mesita-listed rows deep-link into the venue detail modal. Rows
  // that aren't on Mesita yet stay as a non-tappable visual entry
  // until the "request invite" flow ships; for now they just sit
  // there as a confirmation the place exists.
  const onMesita =
    prediction.status === "verified_partner_other" ||
    prediction.status === "verified_partner_self" ||
    prediction.status === "web_listed";

  const body = (
    <div className="border-border bg-card hover:bg-muted/40 flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          meta.iconClass,
        )}
      >
        <meta.Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display block truncate text-[14px] font-semibold tracking-tight">
            {prediction.mainText}
          </span>
          {prediction.status === "verified_partner_self" && (
            <Sparkles
              className="text-pink-500 h-3 w-3 shrink-0"
              strokeWidth={2.25}
            />
          )}
        </span>
        {prediction.secondaryText && (
          <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
            {prediction.secondaryText}
          </span>
        )}
        <span
          className={cn(
            "mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase",
            meta.badgeClass,
          )}
        >
          {meta.label}
        </span>
      </span>
    </div>
  );

  if (onMesita) {
    // We don't yet know the Mesita venue slug from the prediction —
    // the place_id flows through but the venue detail route expects a
    // slug. Punt to the unauthenticated route once the EF returns slugs;
    // for now the row links to the deep-search-with-prefill on Catalog.
    return (
      <Link
        href={`/discover/catalog?q=${encodeURIComponent(prediction.mainText)}`}
        className="block"
      >
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}
