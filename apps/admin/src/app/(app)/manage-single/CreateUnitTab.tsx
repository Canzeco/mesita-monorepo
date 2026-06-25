"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Loader2,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import {
  createUnitFromPlaceId,
  findVenueByPlaceId,
  suggestPlaces,
  type PlacePrediction,
  type PlacePredictionStatus,
} from "./actions";
import { ErrorNote, SectionCard } from "./ui";

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_BADGE: Record<
  PlacePredictionStatus,
  { label: string; className: string; Icon: typeof MapPin }
> = {
  not_in_mesita: {
    label: "New",
    className: "bg-muted text-muted-foreground",
    Icon: MapPin,
  },
  web_listed: {
    label: "On Mesita · unclaimed",
    className: "bg-secondary/15 text-secondary",
    Icon: MapPin,
  },
  verified_partner_other: {
    label: "On Mesita · claimed",
    className: "bg-amber-100 text-amber-800",
    Icon: CheckCircle2,
  },
  verified_partner_self: {
    label: "On Mesita · claimed",
    className: "bg-amber-100 text-amber-800",
    Icon: Crown,
  },
};

export function CreateUnitTab() {
  const router = useRouter();
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      if (query.trim().length < 2) setPredictions([]);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const r = await suggestPlaces(query, sessionTokenRef.current);
      if (cancelled) return;
      setSearching(false);
      if (!r.ok) {
        setSearchError(r.error);
        setPredictions([]);
        return;
      }
      setPredictions(r.data);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selected]);

  const resetSearch = () => {
    setQuery("");
    setPredictions([]);
    setSelected(null);
    setSearchError(null);
    setError(null);
    sessionTokenRef.current = newSessionToken();
  };

  const onPick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setPredictions([]);
    setError(null);
    setSearchError(null);

    start(async () => {
      if (prediction.status === "not_in_mesita") {
        const created = await createUnitFromPlaceId(prediction.placeId);
        if (!created.ok) {
          setError(created.error);
          return;
        }
        router.push(`/manage-single/${created.venueId}`);
        return;
      }

      const found = await findVenueByPlaceId(prediction.placeId);
      if (!found.ok) {
        setError(found.error);
        return;
      }
      if (!found.found) {
        setError("This place is marked on Mesita but could not be loaded. Try again.");
        return;
      }
      router.push(`/manage-single/${found.venue.id}`);
    });
  };

  const onPasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = placeId.trim();
    if (!id) return;

    start(async () => {
      const found = await findVenueByPlaceId(id);
      if (!found.ok) {
        setError(found.error);
        return;
      }
      if (found.found) {
        router.push(`/manage-single/${found.venue.id}`);
        return;
      }

      const created = await createUnitFromPlaceId(id);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      router.push(`/manage-single/${created.venueId}`);
    });
  };

  return (
    <SectionCard
      icon={<Plus className="text-muted-foreground h-4 w-4" />}
      title="Create Single Unit"
      subtitle="Search Google Places, pick a candidate, and create the unit. Existing Mesita units show as unclaimed or claimed before you select."
    >
      <div className="relative mt-5">
        <div className="border-border bg-background focus-within:border-foreground flex items-center gap-2 rounded-xl border px-3">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (selected) setSelected(null);
              if (next.trim().length < 2) setPredictions([]);
            }}
            placeholder="Search place name — e.g. Tetetlán, Casa Luminar…"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
          {(searching || pending) && (
            <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
          )}
          {(query || selected) && !searching && !pending && (
            <button
              type="button"
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {!selected && predictions.length > 0 && (
          <ul className="border-border bg-card absolute inset-x-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border p-1.5 shadow-lg">
            {predictions.map((p) => {
              const badge = STATUS_BADGE[p.status];
              return (
                <li key={p.placeId}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onPick(p)}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-lg p-3 text-left transition disabled:opacity-50"
                  >
                    <span
                      className={
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
                        badge.className
                      }
                    >
                      <badge.Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.mainText}</span>
                        <span
                          className={
                            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase " +
                            badge.className
                          }
                        >
                          {badge.label}
                        </span>
                      </span>
                      {p.secondaryText && (
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {p.secondaryText}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {searchError && <ErrorNote message={searchError} />}

      {!selected &&
        !searching &&
        !searchError &&
        query.trim().length >= 2 &&
        predictions.length === 0 && (
          <p className="text-muted-foreground mt-3 text-sm">
            No Google matches. Try a different spelling or paste a Place ID below.
          </p>
        )}

      {selected && (
        <div className="border-border bg-background mt-4 rounded-xl border p-4">
          <p className="text-sm font-medium">{selected.mainText}</p>
          {selected.secondaryText && (
            <p className="text-muted-foreground mt-1 text-xs">{selected.secondaryText}</p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            {pending
              ? selected.status === "not_in_mesita"
                ? "Creating unit and running ADEA enrichment…"
                : "Opening existing unit…"
              : STATUS_BADGE[selected.status].label}
          </p>
        </div>
      )}

      <details className="border-border mt-6 rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Paste Google Place ID
        </summary>
        <form onSubmit={onPasteSubmit} className="mt-4 space-y-3">
          <input
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            spellCheck={false}
            className="border-border bg-background focus:border-foreground h-10 w-full rounded-lg border px-3 font-mono text-sm outline-none"
          />
          <button
            type="submit"
            disabled={pending || placeId.trim().length === 0}
            className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
              </>
            ) : (
              "Create or open"
            )}
          </button>
        </form>
      </details>

      {error && <ErrorNote message={error} />}

      {error && selected && selected.status === "not_in_mesita" && (
        <div className="border-border bg-background mt-4 flex items-start gap-2 rounded-xl border p-4 text-sm">
          <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <p>Create failed. The place may already exist — try Edit Single Unit.</p>
        </div>
      )}
    </SectionCard>
  );
}

function newSessionToken(): string {
  return crypto.randomUUID();
}
