"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCreateVenueAsConsumerResult,
  apiFetchPublicVenues,
  apiSuggestPlaces,
  type PlacePrediction,
  type Venue,
} from "@/lib/api/venues";
import { VenueCatalogCard } from "@/components/consumer/VenueCatalogCard";
import { cn, errMsg } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;
const ADD_STATUS_ROTATE_MS = 2_000;
const ADD_DRAFT_STORAGE_KEY = "mesita:add-venue:draft";
const ADD_PROGRESS_STAGES = [
  "Preparing venue draft...",
  "Reading place profile...",
  "Collecting core fields...",
  "Normalizing address...",
  "Synthesizing summary...",
  "Synthesizing vibe...",
  "Generating SEO copy...",
  "Classifying category...",
  "Searching website...",
  "Searching Facebook...",
  "Searching Instagram...",
  "Searching TikTok...",
  "Searching Google Maps...",
  "Extracting social links...",
  "Extracting contact data...",
  "Checking photos...",
  "Ranking photos...",
  "Finalizing listing fields...",
  "Saving venue record...",
  "Publishing to Mesita...",
  "Detecting neighborhood context...",
  "Refining cuisine tags...",
  "Validating opening hours...",
  "Cross-checking phone numbers...",
  "Checking reservation providers...",
  "Verifying map coordinates...",
  "Building address aliases...",
  "Cleaning punctuation and accents...",
  "Matching duplicate candidates...",
  "Scoring profile confidence...",
  "Extracting menu hints...",
  "Extracting dietary options...",
  "Extracting payment methods...",
  "Extracting parking notes...",
  "Extracting dress code signals...",
  "Extracting ambience signals...",
  "Analyzing family-friendly signals...",
  "Analyzing group-friendly signals...",
  "Analyzing date-night signals...",
  "Compiling accessibility notes...",
  "Compiling outdoor seating notes...",
  "Compiling pet-friendly notes...",
  "Building short description...",
  "Building long description...",
  "Formatting highlights...",
  "Generating feature bullets...",
  "Generating search keywords...",
  "Creating fallback copy...",
  "Reviewing photo metadata...",
  "Selecting hero image candidate...",
  "Selecting gallery image candidates...",
  "Optimizing media ordering...",
  "Checking broken source links...",
  "Reconciling conflicting details...",
  "Applying trust safeguards...",
  "Applying quality filters...",
  "Preparing moderation flags...",
  "Preparing verification state...",
  "Assigning unverified badge...",
  "Creating listing slug...",
  "Updating discovery index...",
  "Updating map index...",
  "Updating search index...",
  "Preparing recommendation signals...",
  "Syncing venue relationships...",
  "Warming cache...",
  "Running final consistency pass...",
  "Committing profile snapshot...",
  "Verifying publish payload...",
  "Finishing up...",
];

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function predictionLabel(prediction: PlacePrediction): string {
  return `${prediction.mainText}${prediction.secondaryText ? ` · ${prediction.secondaryText}` : ""}`;
}

type PersistedAddDraft = {
  status: "pending" | "success" | "error" | "exists";
  startedAt: number;
  query: string;
  selected: PlacePrediction;
  message?: string;
  venueId?: string;
  venueSlug?: string;
  venueName?: string;
  venueListingType?: "partner" | "web";
};

function persistAddDraft(draft: PersistedAddDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADD_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function clearAddDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADD_DRAFT_STORAGE_KEY);
}

export default function AiPage() {
  const supabase = useBrowserSupabase();
  const sessionTokenRef = useRef(newSessionToken());
  const mountedRef = useRef(true);

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [resultVenue, setResultVenue] = useState<Venue | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addStageIdx, setAddStageIdx] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Recover in-flight / completed add state when user leaves and returns to Add.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(ADD_DRAFT_STORAGE_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as PersistedAddDraft;
      setSelected(draft.selected);
      setQuery(draft.query || predictionLabel(draft.selected));
      if (draft.status === "pending") {
        setIsAdding(true);
        setAddError(null);
        setAddSuccess(null);
        const elapsed = Math.max(0, Date.now() - draft.startedAt);
        const baseIdx =
          Math.floor(elapsed / ADD_STATUS_ROTATE_MS) % ADD_PROGRESS_STAGES.length;
        setAddStageIdx(baseIdx);
        return;
      }
      setIsAdding(false);
      setAddStageIdx(0);
      if (draft.status === "success") {
        setAddSuccess(draft.message ?? null);
        setAddError(null);
        setResultVenue(
          draft.venueId
            ? venueCardFromDraft(
                draft.venueId,
                draft.venueSlug,
                draft.venueName,
                draft.venueListingType ?? "web",
              )
            : null,
        );
      } else if (draft.status === "exists") {
        setAddError(draft.message ?? null);
        setAddSuccess(null);
        setResultVenue(
          draft.venueId
            ? venueCardFromDraft(
                draft.venueId,
                draft.venueSlug,
                draft.venueName,
                draft.venueListingType ?? "web",
              )
            : null,
        );
      } else {
        setAddError(draft.message ?? "Could not add venue.");
        setAddSuccess(null);
        setResultVenue(null);
      }
    } catch {
      clearAddDraft();
    }
  }, []);

  // If the user navigates away and comes back while generation is running,
  // keep checking the shared session draft until it flips to success/error.
  useEffect(() => {
    if (!isAdding || typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const raw = window.sessionStorage.getItem(ADD_DRAFT_STORAGE_KEY);
      if (!raw) return;
      try {
        const draft = JSON.parse(raw) as PersistedAddDraft;
        if (draft.status === "pending") return;
        setIsAdding(false);
        setAddStageIdx(0);
        if (draft.status === "success") {
          setAddSuccess(draft.message ?? null);
          setAddError(null);
          setResultVenue(
            draft.venueId
              ? venueCardFromDraft(
                  draft.venueId,
                  draft.venueSlug,
                  draft.venueName,
                  draft.venueListingType ?? "web",
                )
              : null,
          );
        } else if (draft.status === "exists") {
          setAddError(draft.message ?? null);
          setAddSuccess(null);
          setResultVenue(
            draft.venueId
              ? venueCardFromDraft(
                  draft.venueId,
                  draft.venueSlug,
                  draft.venueName,
                  draft.venueListingType ?? "web",
                )
              : null,
          );
        } else {
          setAddError(draft.message ?? "Could not add venue.");
          setAddSuccess(null);
          setResultVenue(null);
        }
      } catch {
        clearAddDraft();
        setIsAdding(false);
        setResultVenue(null);
      }
    }, 800);
    return () => window.clearInterval(id);
  }, [isAdding]);

  // Replace the temporary draft card with the real venue row as soon as it
  // is available so the preview shows real photos and metadata.
  useEffect(() => {
    if (!resultVenue?.id) return;
    if (resultVenue.photos.length > 0) return;
    let cancelled = false;
    void (async () => {
      const hydrated = await hydrateResultVenue(supabase, resultVenue);
      if (!cancelled && hydrated) setResultVenue(hydrated);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, resultVenue?.id, resultVenue?.slug, resultVenue?.photos.length]);

  const trimmed = query.trim();
  const hasStartedSearch =
    trimmed.length > 0 || searching || predictions.length > 0 || selected !== null;

  // Simulated progress ticker while the create call is inflight. We don't
  // receive server-side stage events yet, so this keeps users informed and
  // discourages bailing early during the 3-5 minute processing window.
  useEffect(() => {
    if (!isAdding) {
      setAddStageIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setAddStageIdx((prev) => (prev + 1) % ADD_PROGRESS_STAGES.length);
    }, ADD_STATUS_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isAdding]);

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const rows = await apiSuggestPlaces(supabase, trimmed, sessionTokenRef.current);
        if (!cancelled) setPredictions(rows);
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
  }, [supabase, trimmed]);

  const onPick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setQuery(predictionLabel(prediction));
    setPredictions([]);
    setAddError(null);
    setAddSuccess(null);
  };

  const onAddVenue = () => {
    if (!selected || isAdding) return;
    setAddError(null);
    setAddSuccess(null);
    setResultVenue(null);
    setAddStageIdx(0);
    setIsAdding(true);
    const startedAt = Date.now();
    persistAddDraft({
      status: "pending",
      startedAt,
      query: predictionLabel(selected),
      selected,
    });
    void (async () => {
      try {
        const result = await apiCreateVenueAsConsumerResult(supabase, selected.placeId);
        if (result.kind === "already_exists") {
          persistAddDraft({
            status: "exists",
            startedAt,
            query: predictionLabel(selected),
            selected,
            message: result.message,
            venueId: result.existing?.id,
            venueSlug: result.existing?.slug ?? undefined,
            venueName: result.existing?.name ?? selected.mainText,
            venueListingType: result.existing?.listing_type ?? "web",
          });
          if (!mountedRef.current) return;
          setAddError(result.message);
          setAddSuccess(null);
          setResultVenue(
            result.existing?.id
              ? venueCardFromDraft(
                  result.existing.id,
                  result.existing.slug ?? undefined,
                  result.existing.name ?? selected.mainText,
                  result.existing.listing_type ?? "web",
                )
              : null,
          );
          return;
        }
        persistAddDraft({
          status: "success",
          startedAt,
          query: predictionLabel(selected),
          selected,
          message: result.message,
          venueId: result.venue.id,
          venueSlug: result.venue.slug,
          venueName: result.venue.name,
          venueListingType: "web",
        });
        if (!mountedRef.current) return;
        setAddSuccess(result.message);
        setAddError(null);
        setResultVenue(
          venueCardFromDraft(result.venue.id, result.venue.slug, result.venue.name, "web"),
        );
      } catch (err) {
        const errorMessage = errMsg(err, "Could not add venue.");
        persistAddDraft({
          status: "error",
          startedAt,
          query: predictionLabel(selected),
          selected,
          message: errorMessage,
        });
        if (!mountedRef.current) return;
        setAddError(errorMessage);
        setAddSuccess(null);
        setResultVenue(null);
      } finally {
        if (!mountedRef.current) return;
        setIsAdding(false);
      }
    })();
  };

  return (
    <div className="h-full overflow-y-auto px-4 pt-3 pb-6">
      <div className="mx-auto flex w-full max-w-xl flex-col text-center">
        <section className="border-border bg-card w-full rounded-2xl border p-3 text-left">
            <label className="border-border bg-background focus-within:border-foreground/40 flex items-center gap-2 rounded-full border px-4 py-3 transition">
              <Search className="text-muted-foreground h-4 w-4 shrink-0" />
              <input
                type="text"
                value={query}
                disabled={isAdding}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  setSelected(null);
                  setAddError(null);
                  setAddSuccess(null);
                  setResultVenue(null);
                  if (!isAdding) clearAddDraft();
                  if (next.trim().length < 2) {
                    setPredictions([]);
                    setSearching(false);
                    setSearchError(null);
                  }
                }}
                placeholder="Search place by name"
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
              />
              {searching && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
            </label>

            {!hasStartedSearch && (
              <p className="text-muted-foreground mt-3 px-1 text-center text-[12px] leading-relaxed">
                Add places that are not on Mesita yet. The profile is generated by
                AI by searching the internet, and it will be created as not verified
                until someone verifies ownership.
              </p>
            )}

            {searchError && (
              <p className="bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 text-xs">
                {searchError}
              </p>
            )}

            {predictions.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {predictions.map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => onPick(p)}
                      className={cn(
                        "border-border bg-background hover:bg-muted/50 flex w-full flex-col rounded-xl border px-3 py-2 text-left transition",
                        selected?.placeId === p.placeId && "border-secondary",
                      )}
                    >
                      <span className="truncate text-sm font-semibold">{p.mainText}</span>
                      {!!p.secondaryText && (
                        <span className="text-muted-foreground truncate text-[11.5px]">
                          {p.secondaryText}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={!selected || isAdding}
              onClick={onAddVenue}
              className="bg-foreground text-background mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {ADD_PROGRESS_STAGES[addStageIdx]}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add selected venue
                </>
              )}
            </button>

            {isAdding ? (
              <p className="text-muted-foreground mt-2 text-center text-[11px] leading-relaxed">
                This process can take around 3 to 5 minutes. Please stay on this
                screen while we finish creating the venue. We generate the profile
                with AI using internet sources, and it is published as not verified
                until ownership is verified.
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-center text-[11px]">
                AI generates this profile by searching the internet. It is listed as
                not verified until someone verifies ownership.
              </p>
            )}

            {addError && (
              <p className="bg-destructive/10 text-destructive mt-3 rounded-xl px-3 py-2 text-xs">
                {addError}
              </p>
            )}
            {addSuccess && (
              <>
                <p className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/12 px-3 py-2 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {addSuccess}
                </p>
              </>
            )}
            {resultVenue && (
              <div className="mx-auto mt-3 w-full max-w-[280px]">
                <VenueCatalogCard
                  venue={resultVenue}
                  href={resultVenue.slug ? `/venues/${resultVenue.slug}` : `/venues/${resultVenue.id}`}
                />
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

function venueCardFromDraft(
  id: string,
  slug: string | undefined,
  name: string | undefined,
  listingType: "partner" | "web",
): Venue {
  const nowIso = new Date().toISOString();
  return {
    id,
    slug: slug ?? id,
    name: name ?? "Venue",
    category: null,
    category_label: null,
    vibe: null,
    price_level: null,
    currency: "MXN",
    listing_type: listingType,
    status: "active",
    fiscal_type: "formal",
    plan: "free",
    lat: null,
    lng: null,
    address: null,
    closes_at: null,
    phone: null,
    pitch: null,
    story: null,
    cashback_percent: null,
    photos: [],
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: nowIso,
  };
}

async function hydrateResultVenue(
  supabase: ReturnType<typeof useBrowserSupabase>,
  draft: Venue,
): Promise<Venue | null> {
  try {
    const venues = await apiFetchPublicVenues(supabase, 400);
    const match = venues.find(
      (venue) => venue.id === draft.id || venue.slug === draft.slug,
    );
    if (!match || match.photos.length === 0) return null;
    return match;
  } catch {
    return null;
  }
}
