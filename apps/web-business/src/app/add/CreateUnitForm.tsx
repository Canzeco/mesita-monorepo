"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiEnrichCreatePlace,
  apiPlacesAutocomplete,
  type PlacePrediction,
} from "@/lib/api/places";
import { apiLookupPlace, type LookupResult } from "@/lib/api/verifications";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { placePath } from "@/lib/business-route-contract";
import {
  ErrorCard,
  NotInMesitaCard,
  PendingByMeCard,
  PendingByOtherCard,
  VerifiedPartnerCard,
  WebListedCard,
} from "./create-unit-status-cards";
import {
  PREDICTION_BADGE,
  newSessionToken,
  type VerificationCallbacks,
} from "./create-unit-shared";

const SEARCH_DEBOUNCE_MS = 220;

// Rolling status messages cycled into the Generate button while
// business-web-create-project is running.
const GENERATE_STAGE_MS = 6000;
const GENERATE_STAGES = [
  "Fetching Google profile…",
  "Scanning the place's website…",
  "Cross-checking social signals…",
  "Synthesising the catalog entry…",
];

export function CreateUnitForm({ signedInEmail }: { signedInEmail: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  // Search/autocomplete state.
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);

  // Lookup state (after pick).
  const [lookupPending, startLookup] = useTransition();
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Generate-profile state (business-web-create-project).
  const [generatePending, startGenerate] = useTransition();
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Debounced autocomplete.
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
          setSearchError(errMsg(err, "Search failed."));
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
    setLookup(null);
    setLookupError(null);
    setGenerateError(null);
    startLookup(async () => {
      try {
        const r = await apiLookupPlace(supabase, prediction.placeId);
        setLookup(r);
      } catch (err) {
        setLookupError(errMsg(err, "Could not look up that place."));
      }
    });
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setPredictions([]);
    setLookup(null);
    setLookupError(null);
    setGenerateError(null);
    sessionTokenRef.current = newSessionToken();
  };

  const refreshLookup = async () => {
    if (!selected) return;
    try {
      const r = await apiLookupPlace(supabase, selected.placeId);
      setLookup(r);
    } catch (err) {
      setLookupError(errMsg(err, "Could not refresh lookup."));
    }
  };

  const onGenerate = () => {
    if (!selected || generatePending) return;
    setGenerateError(null);
    setGenerateStage(GENERATE_STAGES[0]);
    let stageStep = 0;
    const stageInterval = window.setInterval(() => {
      stageStep = Math.min(stageStep + 1, GENERATE_STAGES.length - 1);
      setGenerateStage(GENERATE_STAGES[stageStep]);
    }, GENERATE_STAGE_MS);

    startGenerate(async () => {
      try {
        await apiEnrichCreatePlace(supabase, selected.placeId);
        setGenerateStage("Done");
        await refreshLookup();
      } catch (err) {
        setGenerateError(errMsg(err, "Could not create place."));
        setGenerateStage(null);
      } finally {
        window.clearInterval(stageInterval);
      }
    });
  };

  const verificationCallbacks: VerificationCallbacks = {
    supabase,
    signedInEmail,
    onApproved: (projectId) => {
      router.push(placePath(projectId));
      router.refresh();
    },
    onAwaitingAdmin: () => {
      void refreshLookup();
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search box */}
      <div className="relative">
        <div className="border-border bg-card shadow-elev rounded-[26px] border p-[5px]">
          <div className="border-border bg-background flex items-center gap-3 rounded-[20px] border px-5">
            <Search className="text-muted-foreground h-[19px] w-[19px] shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (selected) {
                  setSelected(null);
                  setLookup(null);
                }
                if (next.trim().length < 2) setPredictions([]);
              }}
              placeholder="Search by place name — e.g. Casa Luminar, Strana…"
              className="placeholder:text-muted-foreground/60 h-14 w-full bg-transparent text-base outline-none"
            />
            {selected && !searching && !lookupPending && (
              <button
                type="button"
                onClick={reset}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold"
              >
                Clear
              </button>
            )}
            {(searching || lookupPending) && (
              <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
            )}
          </div>
        </div>

        {!selected && predictions.length > 0 && (
          <ul className="border-border bg-card shadow-elev absolute inset-x-0 z-20 mt-2.5 max-h-80 overflow-y-auto rounded-[18px] border p-1.5">
            {predictions.map((p) => {
              const meta = PREDICTION_BADGE[p.status];
              return (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-[13px] p-3 text-left transition"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        meta.iconClass,
                      )}
                    >
                      <meta.Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-sm font-semibold">
                          {p.mainText}
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase",
                            meta.badgeClass,
                          )}
                        >
                          {meta.label}
                        </span>
                      </span>
                      {p.secondaryText && (
                        <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
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

      {searchError && (
        <p className={cn(ERROR_BOX_CLASS, "rounded-xl px-4 py-3 text-sm")}>
          {searchError}
        </p>
      )}

      {!selected &&
        !searching &&
        !searchError &&
        query.trim().length >= 2 &&
        predictions.length === 0 && (
          <p className="text-muted-foreground px-1 text-xs leading-relaxed">
            No matches. Try a different spelling, drop the city qualifier, or
            paste the place&apos;s exact Google profile name.
          </p>
        )}

      {selected && lookupError && (
        <ErrorCard message={lookupError} onRetry={refreshLookup} />
      )}

      {selected && lookup && (
        <>
          {lookup.state === "not_in_mesita" && (
            <NotInMesitaCard
              prediction={selected}
              pending={generatePending}
              stage={generateStage}
              error={generateError}
              onGenerate={onGenerate}
            />
          )}

          {lookup.state === "web_listed_unclaimed" && (
            <WebListedCard
              place={lookup.place}
              methods={lookup.methods}
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_me" && (
            <PendingByMeCard
              place={lookup.place}
              methods={lookup.methods}
              codeVerified={
                typeof lookup.verification.payload.codeVerifiedAt === "string"
              }
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_other" && (
            <PendingByOtherCard
              place={lookup.place}
              methods={lookup.methods}
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "verified_partner" && (
            <VerifiedPartnerCard
              place={lookup.place}
              ownerEmail={lookup.owner.email}
            />
          )}
        </>
      )}
    </div>
  );
}
