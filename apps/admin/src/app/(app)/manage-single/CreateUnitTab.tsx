"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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

const SEARCH_DEBOUNCE_MS = 1000;

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
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existsName, setExistsName] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const trimmed = query.trim();
  const placeIdMode = looksLikePlaceId(trimmed);

  useEffect(() => {
    if (selected || trimmed.length < 2 || placeIdMode) {
      if (trimmed.length < 2 || placeIdMode) setPredictions([]);
      setSearching(false);
      return;
    }

    setSearching(false);
    setSearchedQuery(null);
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const r = await suggestPlaces(trimmed, sessionTokenRef.current);
      if (cancelled) return;
      setSearching(false);
      setSearchedQuery(trimmed);
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
  }, [trimmed, selected, placeIdMode]);

  const resetSearch = () => {
    setQuery("");
    setPredictions([]);
    setSelected(null);
    setSearchError(null);
    setError(null);
    setExistsName(null);
    sessionTokenRef.current = newSessionToken();
    setSearchedQuery(null);
  };

  const createFromPlaceId = (placeId: string, label?: string) => {
    setError(null);
    setExistsName(null);
    setSearchError(null);

    start(async () => {
      const found = await findVenueByPlaceId(placeId);
      if (!found.ok) {
        setError(found.error);
        return;
      }
      if (found.found) {
        setExistsName(found.venue.name);
        if (label) {
          setSelected({
            placeId,
            mainText: label,
            secondaryText: "",
            status: "web_listed",
          });
        }
        return;
      }

      const created = await createUnitFromPlaceId(placeId);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      router.push(`/manage-single/${created.venueId}/place`);
    });
  };

  const onPick = (prediction: PlacePrediction) => {
    if (prediction.status !== "not_in_mesita") {
      setError(null);
      setExistsName(prediction.mainText);
      setSelected(prediction);
      return;
    }

    setSelected(prediction);
    setPredictions([]);
    createFromPlaceId(prediction.placeId, prediction.mainText);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || pending) return;

    if (placeIdMode) {
      setSelected(null);
      createFromPlaceId(trimmed, trimmed);
      return;
    }

    if (predictions.length === 1 && predictions[0].status === "not_in_mesita") {
      onPick(predictions[0]);
    }
  };

  return (
    <SectionCard
      icon={<Plus className="text-muted-foreground h-4 w-4" />}
      title="Create Single Unit"
      subtitle="Search by place name or paste a Google Place ID, then create. Units already on Mesita cannot be created again — use Edit Single Unit."
    >
      <form onSubmit={onSubmit} className="relative mt-5">
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
              setError(null);
              setExistsName(null);
              setSearchError(null);
              if (next.trim().length < 2) {
                setPredictions([]);
                setSearching(false);
              }
            }}
            placeholder="Place name or Google Place ID…"
            spellCheck={false}
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

        {!selected && !placeIdMode && predictions.length > 0 && (
          <ul className="border-border bg-card absolute inset-x-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border p-1.5 shadow-lg">
            {predictions.map((p) => {
              const badge = STATUS_BADGE[p.status];
              const canCreate = p.status === "not_in_mesita";
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
                      {!canCreate && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Already on Mesita — use Edit Single Unit
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      {placeIdMode && !pending && !existsName && (
        <p className="text-muted-foreground mt-3 text-sm">
          Place ID detected. Press Enter to create this unit.
        </p>
      )}

      {searchError && <ErrorNote message={searchError} />}

      {!selected &&
        !placeIdMode &&
        !searching &&
        !searchError &&
        searchedQuery === trimmed &&
        trimmed.length >= 2 &&
        predictions.length === 0 && (
          <p className="text-muted-foreground mt-3 text-sm">
            No Google matches. Try a different spelling or paste the Place ID.
          </p>
        )}

      {selected && pending && (
        <div className="border-border bg-background mt-4 rounded-xl border p-4">
          <p className="text-sm font-medium">{selected.mainText}</p>
          {selected.secondaryText && (
            <p className="text-muted-foreground mt-1 text-xs">{selected.secondaryText}</p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Creating unit and running ADEA enrichment…
          </p>
        </div>
      )}

      {existsName && (
        <div className="border-border bg-background mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">{existsName}</span> is already on Mesita. Create
              only adds new units — open it from Edit Single Unit.
            </p>
          </div>
          <Link
            href="/manage-single/select"
            className="border-border hover:border-foreground/40 shrink-0 rounded-full border px-4 py-2 text-center text-sm font-semibold transition"
          >
            Edit Single Unit
          </Link>
        </div>
      )}

      {error && <ErrorNote message={error} />}
    </SectionCard>
  );
}

function looksLikePlaceId(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 10 || /\s/.test(s)) return false;
  if (/^(ChI|EhI|GhI)/.test(s)) return true;
  return /^[A-Za-z0-9_-]+$/.test(s) && s.length >= 20;
}

function newSessionToken(): string {
  return crypto.randomUUID();
}
