"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles, MapPin, Check } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiEnrichCreateVenue,
  apiPlacesAutocomplete,
  type EnrichmentReport,
  type PlacePrediction,
} from "@/lib/api/venues";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;

type Selection = PlacePrediction;

export function CreateUnitForm() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // Session token groups autocomplete keystrokes + the eventual details call
  // into a single Google Places billing session (lower cost).
  const sessionTokenRef = useRef(newSessionToken());

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);

  const [createPending, startCreate] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createReport, setCreateReport] = useState<EnrichmentReport | null>(
    null,
  );
  const [createStage, setCreateStage] = useState<string | null>(null);

  // Debounced autocomplete. Cleanup of stale predictions happens in the
  // change handlers (onChange / pick / reset) so this effect only owns the
  // network round-trip — no synchronous setState on the empty-query path.
  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await apiPlacesAutocomplete(
          supabase,
          query,
          sessionTokenRef.current,
        );
        if (!cancelled) setPredictions(results);
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : "Search failed.");
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
  }, [query, selected, supabase]);

  const pick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setQuery(`${prediction.mainText} · ${prediction.secondaryText}`.trim());
    setPredictions([]);
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setPredictions([]);
    setCreateError(null);
    setCreateReport(null);
    sessionTokenRef.current = newSessionToken();
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || createPending) return;
    setCreateError(null);
    setCreateReport(null);
    setCreateStage("Fetching Google profile…");

    // Rotate stage text every few seconds while we wait, so the manager sees
    // something is happening. The Edge Function runs the whole pipeline in
    // one shot — these labels are best-guess UI affordance, not real events.
    let stageStep = 0;
    const stages = [
      "Fetching Google profile…",
      "Scanning the venue's website…",
      "Cross-checking social signals…",
      "Synthesising the catalog entry…",
    ];
    const stageInterval = window.setInterval(() => {
      stageStep = Math.min(stageStep + 1, stages.length - 1);
      setCreateStage(stages[stageStep]);
    }, 6000);

    startCreate(async () => {
      try {
        const { venue, enrichment } = await apiEnrichCreateVenue(
          supabase,
          selected.placeId,
        );
        setCreateReport(enrichment);
        setCreateStage("Done");
        // Land on the new venue's edit page so the manager sees the row they
        // just created — without ?unit= they'd be dropped on the first venue
        // alphabetically, which is confusing when they have several.
        window.setTimeout(() => {
          router.push(`/manager/home?unit=${venue.id}`);
          router.refresh();
        }, 600);
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : "Could not create venue.",
        );
        setCreateStage(null);
      } finally {
        window.clearInterval(stageInterval);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className="border-border bg-card rounded-2xl border p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Find your Google business profile
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          We pull the catalog entry straight from Google Places, the
          venue&apos;s website, and press mentions — you don&apos;t fill
          anything in.
        </p>

        <div className="relative mt-4">
          <div className="border-border bg-background flex items-center gap-2 rounded-xl border px-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (selected) setSelected(null);
                if (next.trim().length < 2) setPredictions([]);
              }}
              placeholder="Casa Luminar, Polanco…"
              className="placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
              disabled={createPending}
            />
            {selected && !createPending && (
              <button
                type="button"
                onClick={reset}
                className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
              >
                Clear
              </button>
            )}
            {searching && (
              <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
            )}
          </div>

          {!selected && predictions.length > 0 && (
            <ul className="border-border bg-card shadow-elev absolute inset-x-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border">
              {predictions.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="hover:bg-muted/60 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition"
                  >
                    <MapPin className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {p.mainText}
                      </span>
                      {p.secondaryText && (
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {p.secondaryText}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchError && (
            <p className="bg-destructive/10 text-destructive mt-2 rounded-lg px-3 py-2 text-xs">
              {searchError}
            </p>
          )}
        </div>

        {selected && (
          <div className="border-foreground/15 bg-background mt-4 flex items-start gap-3 rounded-xl border p-3">
            <span className="bg-pink-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {selected.mainText}
              </p>
              {selected.secondaryText && (
                <p className="text-muted-foreground truncate text-[11px]">
                  {selected.secondaryText}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {createReport && !createError && <ReportCard report={createReport} />}

      {createError && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
          {createError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!selected || createPending}
          className={cn(
            "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {/* Single indicator on purpose. The rotating stage label lives on
              the button itself — having a separate ProgressCard above the
              button just for the same loading signal read as two competing
              bars. */}
          {createPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {createStage ?? "Creating venue…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Create venue from this profile
            </>
          )}
        </button>
      </div>
      <p className="text-muted-foreground text-center text-[11px]">
        Can take up to 60 seconds. We auto-fill name, hours, photos, vibe, and
        story from Google + your website. You can edit any of it after.
      </p>
    </form>
  );
}

function ReportCard({ report }: { report: EnrichmentReport }) {
  const lines: string[] = [
    `Google Places: ${report.google ? "✓" : "—"}`,
    `Photos pulled: ${report.photoCount}`,
    `Channels found: ${report.channelCount ?? 0}`,
    `Website scrape: ${report.firecrawl ? "✓" : "—"}`,
    `Web research brief: ${report.perplexity ? "✓" : "—"}`,
    `AI synthesis: ${report.openai ? "✓" : "fallback"}`,
  ];
  return (
    <div className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-xs">
      <p className="text-foreground mb-2 text-sm font-semibold">
        Enrichment summary
      </p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
