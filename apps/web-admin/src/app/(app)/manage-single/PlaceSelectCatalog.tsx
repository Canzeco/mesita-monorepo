"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  ImageOff,
  Loader2,
  MapPin,
  Plus,
  Search,
  X } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  findPlaceByPlaceId,
  suggestPlaces,
  type PlacePrediction,
  type PlacePredictionStatus,
  type PlaceHit } from "./actions";
import { placeSectionHref } from "./nav";
import { PlaceThumb } from "./PlaceEditChrome";
import { usePlaceCatalogSearch } from "./usePlaceCatalogSearch";
import { ErrorNote } from "@/components/ErrorNote";

// Minimum characters before a query triggers Mesita/Google search logic.
const MIN_QUERY_LENGTH = 2;

const STATUS_BADGE: Record<
  PlacePredictionStatus,
  { label: string; className: string; Icon: typeof MapPin }
> = {
  not_in_mesita: {
    label: "New · create",
    className: "bg-muted text-muted-foreground",
    Icon: Plus },
  web_listed: {
    label: "On Mesita · unclaimed",
    className: "bg-secondary/15 text-secondary",
    Icon: MapPin },
  verified_partner_other: {
    label: "On Mesita · claimed",
    className: "bg-amber-100 text-amber-800",
    Icon: CheckCircle2 },
  verified_partner_self: {
    label: "On Mesita · claimed",
    className: "bg-amber-100 text-amber-800",
    Icon: Crown } };

export function PlaceSelectCatalog() {
  const router = useRouter();
  const { q, setQ, debouncedQuery, hits, pending, error, metaLabel, searchedQuery, clear } =
    usePlaceCatalogSearch();

  const sessionTokenRef = useRef(newSessionToken());
  const googleRequestIdRef = useRef(0);
  // Query-keyed Google results — setState only after await (same pattern as usePlaceCatalogSearch).
  const [googleRemote, setGoogleRemote] = useState<{
    query: string;
    predictions: PlacePrediction[];
  } | null>(null);
  const [googleRemoteError, setGoogleRemoteError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingLabel, setCreatingLabel] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();
  // The Google prediction awaiting an explicit "Add to Mesita" confirmation.
  // Set only for creatable (not_in_mesita) results — existing places open directly.
  const [confirm, setConfirm] = useState<PlacePrediction | null>(null);

  const trimmed = q.trim();
  const placeIdMode = looksLikePlaceId(trimmed);
  const catalogSettledEmpty =
    !pending &&
    !error &&
    searchedQuery !== null &&
    searchedQuery === trimmed &&
    hits.length === 0 &&
    trimmed.length >= MIN_QUERY_LENGTH;

  // Show Google lane when Mesita has nothing for this query — including while
  // Mesita is still in flight (optimistic empty) so both spinners are visible.
  // Hide once Mesita returns hits (create-from-Google path not needed).
  const showGoogleSection =
    !placeIdMode &&
    trimmed.length >= MIN_QUERY_LENGTH &&
    hits.length === 0 &&
    (pending || catalogSettledEmpty);

  // decision: Pato (MESITA-467) — fire Google suggest on the same debounced
  // query as Mesita, not after Mesita settles empty. Sequential fetch left a
  // ~2s dead gap (Mesita spinner clears → silence → Google appears).
  useEffect(() => {
    const query = debouncedQuery;
    if (query.length < MIN_QUERY_LENGTH || looksLikePlaceId(query)) return;

    const id = ++googleRequestIdRef.current;
    void (async () => {
      const r = await suggestPlaces(query, sessionTokenRef.current);
      if (id !== googleRequestIdRef.current) return;
      if (!r.ok) {
        setGoogleRemoteError({ query, message: r.error });
        return;
      }
      setGoogleRemoteError(null);
      setGoogleRemote({ query, predictions: r.data });
    })();
  }, [debouncedQuery]);

  const googleReady = googleRemote !== null && googleRemote.query === trimmed;
  const googleFailed =
    googleRemoteError !== null && googleRemoteError.query === trimmed;
  // In-flight for the settled query (prefetch or display) — independent of Mesita.
  const googleFetching =
    debouncedQuery.length >= MIN_QUERY_LENGTH &&
    debouncedQuery === trimmed &&
    !placeIdMode &&
    !googleReady &&
    !googleFailed;
  // Section spinner: Google still loading, OR Mesita still searching (Google
  // section is already open on optimistic-empty) while we wait for settle.
  const googleSearching =
    showGoogleSection && (googleFetching || (pending && !googleReady && !googleFailed));
  const googlePredictions = googleReady ? googleRemote.predictions : [];
  const googleError =
    googleFailed && googleRemoteError ? googleRemoteError.message : null;
  // Search-bar spinner covers either pipeline so it never blanks mid-flight.
  const anySearching = pending || googleFetching || createPending;

  const pickPlace = (projectId: string) => {
    router.push(placeSectionHref(projectId, "place"));
  };

  const createFromPlaceId = (placeId: string, label?: string) => {
    setCreateError(null);
    setCreatingLabel(label ?? placeId);

    startCreate(async () => {
      const found = await findPlaceByPlaceId(placeId);
      if (!found.ok) {
        setCreateError(found.error);
        setCreatingLabel(null);
        return;
      }
      if (found.found) {
        setCreatingLabel(null);
        router.push(placeSectionHref(found.place.id, "place"));
        return;
      }

      const created = await createPlaceFromGooglePlaceId(placeId);
      if (!created.ok) {
        setCreateError(created.error);
        setCreatingLabel(null);
        return;
      }
      router.push(`/manage-single/${created.projectId}/place`);
    });
  };

  // Creatable results open a confirm modal (explicit "Add to Mesita"); results
  // already on Mesita open directly — no confirmation needed.
  const onPickGoogle = (prediction: PlacePrediction) => {
    if (prediction.status === "not_in_mesita") {
      setCreateError(null);
      setConfirm(prediction);
      return;
    }
    createFromPlaceId(prediction.placeId, prediction.mainText);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || createPending) return;

    if (placeIdMode) {
      createFromPlaceId(trimmed, trimmed);
      return;
    }

    if (hits.length === 1) {
      pickPlace(hits[0].id);
      return;
    }

    const creatable = googlePredictions.filter((p) => p.status === "not_in_mesita");
    if (showGoogleSection && creatable.length === 1) {
      onPickGoogle(creatable[0]);
    }
  };

  const onClear = () => {
    clear();
    googleRequestIdRef.current += 1;
    setGoogleRemote(null);
    setGoogleRemoteError(null);
    setCreateError(null);
    setCreatingLabel(null);
    setConfirm(null);
    sessionTokenRef.current = newSessionToken();
  };

  return (
    <div className="w-full">
      <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-b px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-8">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Manage Single Place
        </p>
        <form onSubmit={onSubmit}>
          <div className="border-border bg-background focus-within:border-foreground focus-within:ring-foreground/10 mt-3 flex h-14 items-center gap-3 rounded-xl border px-4 shadow-sm transition focus-within:ring-2 sm:h-16 sm:gap-4 sm:px-5">
            <Search className="text-muted-foreground h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCreateError(null);
                setCreatingLabel(null);
              }}
              placeholder="Search by name, place id, or Google Place ID…"
              autoFocus
              aria-label="Search places"
              spellCheck={false}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none sm:text-lg"
            />
            {(anySearching) && trimmed.length >= MIN_QUERY_LENGTH && (
              <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
            )}
            {!anySearching && q.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
        {placeIdMode && !createPending && (
          <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
            Google Place ID detected. Press Enter to create or open this place.
          </p>
        )}
      </div>

      <div className="px-4 pt-5 sm:px-6 lg:px-8">
        <p className={sectionLabelClass(pending)}>
          {pending && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          )}
          Manage Single Place results · {metaLabel}
        </p>

        {error && <ErrorNote message={error} />}
        {createError && <ErrorNote message={createError} />}

        {creatingLabel && createPending && (
          <div className="border-border bg-card mt-4 rounded-xl border p-4">
            <p className="text-sm font-medium">{creatingLabel}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Creating place… 
            </p>
          </div>
        )}

        {hits.length > 0 ? (
          <div className="border-border bg-card mt-4 overflow-hidden rounded-xl border">
            <div className="-mx-0 overflow-x-auto">
              {/* The row IS the pipeline, left to right: seeded → listed →
                  enriched →
                  verified → partner → promoting (MESITA-1166). Category, Zone
                  and Google reviews are gone — they describe the place, and
                  this table answers "how far along is it". */}
              <table className="w-full min-w-[840px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-muted-foreground bg-muted/30 text-left text-[11px] font-semibold tracking-[0.08em] uppercase">
                    <th className="w-14 px-3 py-2.5 font-semibold">Photo</th>
                    <th className="px-3 py-2.5 font-semibold">Name</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Seeded</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Listed</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Enriched</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Verified</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Partner</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Promoting</th>
                    <th className="w-10 px-3 py-2.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {hits.map((u) => (
                    <PlaceCatalogRow
                      key={u.id}
                      place={u}
                      disabled={createPending}
                      onPick={() => pickPlace(u.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !pending &&
          !error &&
          searchedQuery === null &&
          trimmed.length === 0 && (
            <div className="border-border bg-card mt-4 rounded-2xl border px-4 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No places in the catalog yet. Search a place name to create one from Google.
              </p>
            </div>
          )
        )}

        {showGoogleSection && (
          <div className="mt-8">
            <p className={sectionLabelClass(googleSearching)}>
              {googleSearching && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              )}
              Not on Mesita · Google results
              {googleSearching
                ? " · Searching…"
                : googleReady
                  ? ` · ${googlePredictions.length}`
                  : ""}
            </p>

            {googleError && <ErrorNote message={googleError} />}

            <div className="mt-4 flex flex-col gap-2">
              {googleSearching && (
                <div className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-xl border px-4 py-6 text-sm">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Looking up Google Places…
                </div>
              )}

              {googlePredictions.map((p) => {
                const badge = STATUS_BADGE[p.status];
                const canCreate = p.status === "not_in_mesita";
                return (
                  <button
                    key={p.placeId}
                    type="button"
                    disabled={createPending}
                    onClick={() => onPickGoogle(p)}
                    className="border-border bg-card hover:border-foreground/40 flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50"
                  >
                    <span
                      className={
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                        badge.className
                      }
                    >
                      <badge.Icon className="h-4 w-4" />
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
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {canCreate
                          ? "Click to review & add"
                          : "Already on Mesita — click to open"}
                      </span>
                    </span>
                    {canCreate ? (
                      <span className="bg-secondary text-secondary-foreground mt-1.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </span>
                    ) : (
                      <ChevronRight className="text-muted-foreground mt-3 h-4 w-4 shrink-0" />
                    )}
                  </button>
                );
              })}

              {!googleSearching &&
                !googleError &&
                googleReady &&
                googlePredictions.length === 0 &&
                catalogSettledEmpty && (
                <div className="border-border bg-card rounded-2xl border px-4 py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    {`No Mesita places or Google matches for “${trimmed}”. Try another spelling or paste a Place ID.`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <AddPlaceModal
          key={confirm.placeId}
          prediction={confirm}
          adding={createPending}
          error={createError}
          onConfirm={() => createFromPlaceId(confirm.placeId, confirm.mainText)}
          onClose={() => {
            setConfirm(null);
            setCreateError(null);
          }}
        />
      )}
    </div>
  );
}

function sectionLabelClass(active: boolean): string {
  return (
    "flex items-center gap-2 text-xs font-medium tracking-wide uppercase transition-colors " +
    (active ? "text-primary" : "text-muted-foreground")
  );
}

function PlaceCatalogRow({
  place,
  disabled,
  onPick }: {
  place: PlaceHit;
  disabled: boolean;
  onPick: () => void;
}) {
  // Google's label specifically, not the generated display name (which is
  // coalesce(mesita_name, google_name) and would hide an operator override).
  const googleName = place.google_name?.trim() || place.name;

  return (
    <tr
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Open ${place.name}`}
      onClick={() => {
        if (!disabled) onPick();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={
        "hover:bg-muted/40 focus-visible:bg-muted/50 cursor-pointer outline-none transition " +
        "[&>td]:border-border/60 [&>td]:border-t " +
        (disabled ? "pointer-events-none opacity-50" : "")
      }
    >
      <td className="px-3 py-2.5">
        <PlaceThumb photo={place.photo} name={place.name} size="sm" />
      </td>
      <td className="max-w-[260px] px-3 py-2.5">
        <p className="truncate font-medium">{googleName}</p>
      </td>
      <td className="px-3 py-2.5 text-center">
        <BoolCell value={place.seeded} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-3 py-2.5 text-center">
        <BoolCell value={place.listed} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-3 py-2.5 text-center">
        <LevelCell
          level={place.enrich_pulse}
          total={place.enrich_pulse_total}
          labels={place.enrich_pulse_labels}
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <BoolCell value={place.verified} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-3 py-2.5 text-center">
        <BoolCell value={place.partner} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-3 py-2.5 text-center">
        <PromoLevelCell level={place.promoting_level} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ChevronRight className="text-muted-foreground ml-auto h-4 w-4" aria-hidden />
      </td>
    </tr>
  );
}

// PROMOTING is a 0-3 rung, not a yes/no: how hard a place is discounting right
// now. 0 is not "no data" — it means a guest gets nothing here at this moment,
// which is also true of a paid Aggressive place whose promo lane is paused. The
// server derives it so the boolean and the rung can never disagree.
const PROMO_TITLE: Record<number, string> = {
  0: "Zero — no live discount",
  1: "Conservative",
  2: "Aggressive",
  3: "Dominant",
};

function PromoLevelCell({ level }: { level: 0 | 1 | 2 | 3 }) {
  const title = PROMO_TITLE[level] ?? `Level ${level}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={
          "text-[11px] font-semibold tabular-nums " +
          (level === 0 ? "text-muted-foreground" : "text-foreground")
        }
      >
        {level}
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {[1, 2, 3].map((rung) => (
          <span
            key={rung}
            className={
              "h-1.5 w-1.5 rounded-[1px] " +
              (level >= rung ? "bg-amber-500" : "bg-muted-foreground/25")
            }
          />
        ))}
      </span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

// ENRICHED is the only non-boolean flag: the PULSE high-water, 0-9
// (Docs › Enrichment §A). Nine steps over an S0 SEED GATE —
//
//   S0 seed (a precondition, not a step)
//   1 pulse · 2 details · 3 links · 4 social · 5 images
//   6 menu · 7 reviews · 8 semantics · 9 embeddings
//
// — and the number is HOW FAR THE QUEUE GOT: the index of the last step such
// that it and everything before it completed. Not a count of steps that
// worked; a gap stops it, because a profile built past a hole is built on
// incomplete data.
//
// 0 means the seed is in place and nothing after it has landed — which also
// covers a place enriched before step reporting existed. That is honest: we do
// not know how far its queue got, and claiming a number would be worse.
//
// The rung NAMES arrive with the number, from PULSE_LABELS_IN_ORDER on the
// admin-web-search-places payload. This file used to keep its own positional
// copy — no shared import, no test, no CI gate — so a reorder in the backend
// would have shown the wrong rung name beside every row and nothing would have
// caught it (MESITA-1222).
function LevelCell(
  { level, total, labels }: { level: number; total: number; labels: string[] },
) {
  // `labels` is 1-indexed by rung, so rung N is labels[N - 1].
  const reached = level > 0 ? labels[level - 1] : null;
  const title = level === 0
    ? "Seeded — nothing after it has landed"
    : `${level}/${total} — reached ${reached ?? `piece ${level}`}` +
      (level === total ? " — complete" : "");
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={
          "text-[11px] font-semibold tabular-nums " +
          (level === 0 ? "text-muted-foreground" : "text-foreground")
        }
      >
        {level}
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
          <span
            key={step}
            className={
              "h-1.5 w-1.5 rounded-[1px] " +
              (level >= step ? "bg-green-600" : "bg-muted-foreground/25")
            }
          />
        ))}
      </span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

function BoolCell({
  value,
  trueLabel,
  falseLabel,
  accent = false }: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  accent?: boolean;
}) {
  if (value) {
    return (
      <span
        className={
          "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold " +
          (accent
            ? "bg-amber-100 text-amber-800"
            : "bg-green-500/10 text-green-700")
        }
      >
        {trueLabel}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-[11px] font-medium">{falseLabel}</span>
  );
}

type GooglePlaceDetails = {
  photoUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
};

// Reopening the modal for the same place shouldn't refetch.
const placeDetailCache = new Map<string, GooglePlaceDetails>();

// Display-only Google Places Details (New) lookup for the confirm modal — one
// client-side call per place for a hero photo + tidy address, keyed by
// NEXT_PUBLIC_GMP_KEY. Nothing is persisted (mirrors the consumer add sheet).
async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
  const cached = placeDetailCache.get(placeId);
  if (cached) return cached;
  const empty: GooglePlaceDetails = { photoUrl: null, address: null, mapsUrl: null };
  const key = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  if (!key) return empty;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
        `?fields=photos,formattedAddress,googleMapsUri&key=${key}`,
    );
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      photos?: { name?: string }[];
      formattedAddress?: string;
      googleMapsUri?: string;
    };
    const photoName = data.photos?.[0]?.name ?? null;
    const details: GooglePlaceDetails = {
      photoUrl: photoName
        ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${key}`
        : null,
      address: data.formattedAddress ?? null,
      mapsUrl: data.googleMapsUri ?? null };
    placeDetailCache.set(placeId, details);
    return details;
  } catch {
    return empty;
  }
}

// Confirm-before-create modal for an external Google result. Fetches a display
// photo + address on open; the primary action runs the existing create flow.
function AddPlaceModal({
  prediction,
  adding,
  error,
  onConfirm,
  onClose }: {
  prediction: PlacePrediction;
  adding: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<GooglePlaceDetails | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  // The modal is keyed by placeId at the render site, so it remounts fresh per
  // place — no synchronous reset needed here (which the set-state-in-effect rule
  // forbids). The only setState lands after the await.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await fetchGooglePlaceDetails(prediction.placeId);
      if (!cancelled) setDetails(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [prediction.placeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adding) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, adding]);

  const address = details?.address ?? prediction.secondaryText ?? null;
  const photoUrl = details?.photoUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!adding) onClose();
      }}
    >
      <div
        className="border-border bg-card w-full max-w-md overflow-hidden rounded-2xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add place to Mesita"
      >
        <div className="bg-muted/40 flex h-44 w-full items-center justify-center overflow-hidden">
          {photoUrl && !photoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={prediction.mainText}
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : details === null ? (
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          ) : (
            <ImageOff className="text-muted-foreground h-7 w-7" />
          )}
        </div>

        <div className="p-5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            Add to Mesita
          </p>
          <h3 className="mt-1 text-base font-semibold">{prediction.mainText}</h3>
          {address && (
            <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{address}</span>
            </p>
          )}
          {details?.mapsUrl && (
            <a
              href={details.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-secondary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View on Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            This place isn’t on Mesita yet. Adding it creates the place and kicks off
            AI enrichment in the background.
          </p>

          {error && <ErrorNote message={error} />}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="text-foreground hover:bg-muted inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={adding}
              className="bg-secondary text-secondary-foreground inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {adding ? "Adding…" : "Add to Mesita"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
