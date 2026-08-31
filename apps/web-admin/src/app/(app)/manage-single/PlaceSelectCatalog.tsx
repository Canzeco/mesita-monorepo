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
import { CldrRegionInput } from "@/components/CldrRegionInput";
import { OPERATOR_PROMOTING_LABEL, operatorPromotingLevel } from "@/lib/status-vocabulary";
import { PROMOTION_SCORE_MAX } from "@/lib/business/promotion-score";

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
  const {
    q,
    setQ,
    debouncedQuery,
    hits,
    pending,
    error,
    metaLabel,
    catalogLoaded,
    clear,
  } = usePlaceCatalogSearch({ searchOnQuery: false });

  const sessionTokenRef = useRef(newSessionToken());
  const deepRequestIdRef = useRef(0);
  // Query-keyed Name Deep Search — same engine as consumer Search.
  const [deepRemote, setDeepRemote] = useState<{
    query: string;
    predictions: PlacePrediction[];
  } | null>(null);
  const [deepRemoteError, setDeepRemoteError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingLabel, setCreatingLabel] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();
  // The Google prediction awaiting an explicit "Add to Mesita" confirmation.
  // Set only for creatable (not_in_mesita) results — existing places open directly.
  const [confirm, setConfirm] = useState<PlacePrediction | null>(null);
  const [regionCode, setRegionCode] = useState("");

  const trimmed = q.trim();
  const placeIdMode = looksLikePlaceId(trimmed);
  const deepReady = deepRemote !== null && deepRemote.query === trimmed;
  const deepFailed =
    deepRemoteError !== null && deepRemoteError.query === trimmed;
  const deepFetching =
    debouncedQuery.length >= MIN_QUERY_LENGTH &&
    debouncedQuery === trimmed &&
    !placeIdMode &&
    !deepReady &&
    !deepFailed;
  const showDeepSection =
    !placeIdMode && trimmed.length >= MIN_QUERY_LENGTH;
  const deepSearching = showDeepSection && deepFetching;
  const deepPredictions = deepReady ? deepRemote.predictions : [];
  const deepError =
    deepFailed && deepRemoteError ? deepRemoteError.message : null;
  const debounceWaiting =
    showDeepSection && trimmed !== debouncedQuery;
  const anySearching = pending || deepFetching || debounceWaiting || createPending;
  const awaitingHits =
    showDeepSection &&
    (deepFetching || debounceWaiting) &&
    deepPredictions.length === 0;
  const catalogIdleEmpty =
    trimmed.length === 0 &&
    !error &&
    catalogLoaded &&
    hits.length === 0;

  useEffect(() => {
    const query = debouncedQuery;
    if (query.length < MIN_QUERY_LENGTH || looksLikePlaceId(query)) return;

    const id = ++deepRequestIdRef.current;
    void (async () => {
      const r = await suggestPlaces(query, sessionTokenRef.current, regionCode);
      if (id !== deepRequestIdRef.current) return;
      if (!r.ok) {
        setDeepRemoteError({ query, message: r.error });
        return;
      }
      setDeepRemoteError(null);
      setDeepRemote({ query, predictions: r.data });
    })();
  }, [debouncedQuery, regionCode]);

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
  const onPickPrediction = (prediction: PlacePrediction) => {
    if (prediction.mesitaId) {
      pickPlace(prediction.mesitaId);
      return;
    }
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

    if (!showDeepSection && hits.length === 1) {
      pickPlace(hits[0].id);
      return;
    }

    if (deepPredictions.length === 1) {
      onPickPrediction(deepPredictions[0]);
    }
  };

  const onClear = () => {
    clear();
    deepRequestIdRef.current += 1;
    setDeepRemote(null);
    setDeepRemoteError(null);
    setCreateError(null);
    setCreatingLabel(null);
    setConfirm(null);
    sessionTokenRef.current = newSessionToken();
  };

  return (
    <div className="w-full">
      <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-b px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-8">
        <p className="text-muted-foreground type-label font-semibold tracking-[0.14em] uppercase">
          Manage Single Place
        </p>
        <form onSubmit={onSubmit}>
          <div className="border-border bg-background focus-within:border-foreground focus-within:ring-foreground/10 mt-3 flex h-14 items-center gap-3 rounded-xl border px-4 shadow-card transition focus-within:ring-2 sm:h-16 sm:gap-4 sm:px-5">
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
            <CldrRegionInput
              compact
              value={regionCode}
              onChange={setRegionCode}
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
        {trimmed.length === 0 && hits.length > 0 && (
          <p className="text-muted-foreground type-eyebrow">{metaLabel}</p>
        )}
        {!catalogLoaded && trimmed.length === 0 && (
          <p
            className="text-muted-foreground flex items-center gap-2 text-sm"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Loading catalog…
          </p>
        )}

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

        {trimmed.length === 0 && hits.length > 0 ? (
          <div className="border-border bg-card mt-4 overflow-hidden rounded-2xl border">
            <div className="-mx-0 overflow-x-auto">
              {/* TWO BLOCKS, left to right (Pato, 2026-08-29). PIPELINE —
                  Active · Listed · Requested · Enriched · Enriching ·
                  Verified — answers "how far along is it". COMMERCIAL —
                  Promotion (the 0–7 score) · Partner · Visit Rewards (0|1|2)
                  · Mesita Pay · Mesita Credits — answers "how much does it
                  offer". Created is deliberately absent: google_place_id is
                  required at create, so the column was Yes on every row and
                  carried no signal. Active is Google's OPERATIONAL fact, not
                  Mesita Listed. */}
              <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
                    <th className="w-14 px-4 py-3 font-semibold">Photo</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 text-center font-semibold">Active</th>
                    <th className="px-4 py-3 text-center font-semibold">Listed</th>
                    <th className="px-4 py-3 text-center font-semibold">Requested</th>
                    <th className="px-4 py-3 text-center font-semibold">Enriched</th>
                    <th className="px-4 py-3 text-center font-semibold">Enriching</th>
                    <th className="px-4 py-3 text-center font-semibold">Verified</th>
                    <th className="px-4 py-3 text-center font-semibold">Offerings</th>
                    <th className="px-4 py-3 text-center font-semibold">Partner</th>
                    <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Visit Rewards</th>
                    <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Mesita Pay</th>
                    <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Mesita Credits</th>
                    <th className="w-10 px-4 py-3" aria-hidden />
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
          catalogIdleEmpty && (
            <p className="text-muted-foreground mt-4 text-sm">
              No places in the catalog yet. Search a place name to create one from Google.
            </p>
          )
        )}

        {showDeepSection && (
          <div className={awaitingHits ? "mt-4" : "mt-2"}>
            {!deepSearching && (
              <p className="text-muted-foreground type-eyebrow">
                Results
                {deepReady ? ` · ${deepPredictions.length}` : ""}
              </p>
            )}

            {deepError && <ErrorNote message={deepError} />}

            <div className="mt-3 flex flex-col gap-2">
              {deepSearching && deepPredictions.length === 0 && (
                <p
                  className="text-muted-foreground flex items-center gap-2 px-0.5 py-1 text-sm"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Searching…
                </p>
              )}

              {deepPredictions.map((p) => {
                const badge = STATUS_BADGE[p.status];
                const canCreate = p.status === "not_in_mesita";
                return (
                  <button
                    key={p.mesitaId ?? p.placeId}
                    type="button"
                    disabled={createPending}
                    onClick={() => onPickPrediction(p)}
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
                            "inline-flex shrink-0 rounded-full px-2 py-0.5 type-meta font-semibold tracking-wide uppercase " +
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

              {!deepSearching &&
                !deepError &&
                deepReady &&
                deepPredictions.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {`No Mesita or Google matches for “${trimmed}”. Try another spelling or paste a Place ID.`}
                </p>
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
      <td className="px-4 py-3.5">
        <PlaceThumb photo={place.photo} name={place.name} size="md" />
      </td>
      <td className="max-w-[260px] px-4 py-3.5">
        <p className="truncate font-semibold">{googleName}</p>
      </td>
      <td className="px-4 py-3.5 text-center">
        <ActiveCell
          status={place.business_status}
          seenAt={place.business_status_at}
        />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.listed} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-4 py-3.5 text-center">
        <RequestCountCell count={place.request_count} />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell
          value={
            place.enrich_pulse_total > 0 &&
            place.enrich_pulse === place.enrich_pulse_total
          }
          trueLabel="Yes"
          falseLabel="No"
        />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.enriching} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.verified} trueLabel="Yes" falseLabel="No" />
      </td>
      <td className="px-4 py-3.5 text-center">
        <PromotionCell score={place.promotion} />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.partner} trueLabel="Yes" falseLabel="No" falseTone="neutral" />
      </td>
      <td className="px-4 py-3.5 text-center">
        <PromoLevelCell level={place.promoting_level} />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.mesita_pay} trueLabel="Yes" falseLabel="No" falseTone="neutral" />
      </td>
      <td className="px-4 py-3.5 text-center">
        <BoolCell value={place.credits} trueLabel="Yes" falseLabel="No" falseTone="neutral" />
      </td>
      <td className="px-4 py-3.5 text-right">
        <ChevronRight className="text-muted-foreground ml-auto h-4 w-4" aria-hidden />
      </td>
    </tr>
  );
}

// PROMOTION is the 0–7 offering score (promotion-score.ts twins): Partner +1
// · Visit Rewards +0/1/2 · each accepted rail +1. Shaped server-side so this
// cell and the Partner tab's Promos bar can never disagree. Display-only —
// never a discovery input ("Rank is never for sale").
function PromotionCell({ score }: { score: number }) {
  const max = PROMOTION_SCORE_MAX;
  const n = Number.isFinite(score) ? Math.max(0, Math.min(max, Math.trunc(score))) : 0;
  const title = `Offerings ${n} of ${max}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={
          "type-label font-semibold tabular-nums " +
          (n === 0 ? "text-muted-foreground" : "text-foreground")
        }
      >
        {n}
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: max }, (_, i) => i + 1).map((rung) => (
          <span
            key={rung}
            className={
              "h-2 w-1 rounded-[1px] " +
              (n >= rung ? "bg-muted-foreground/40" : "bg-muted-foreground/15")
            }
          />
        ))}
      </span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

// VISIT REWARDS is 0 | 1 | 2, not a yes/no: how hard a place is discounting
// right now. 0 is not "no data" — it means a guest gets nothing here at this
// moment, which is also true of a paid Aggressive place whose promo lane is
// paused. Engine Dominant (3) displays as 2.

function PromoLevelCell({ level }: { level: 0 | 1 | 2 | 3 }) {
  const shown = operatorPromotingLevel(level);
  const title = `${OPERATOR_PROMOTING_LABEL[shown]}${shown === 0 ? " — no live discount" : ""}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={
          "type-label font-semibold tabular-nums " +
          (shown === 0 ? "text-muted-foreground" : "text-foreground")
        }
      >
        {shown}
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {[1, 2].map((rung) => (
          <span
            key={rung}
            className={
              "h-2 w-1.5 rounded-[1px] " +
              (shown >= rung ? "bg-muted-foreground/40" : "bg-muted-foreground/15")
            }
          />
        ))}
      </span>
      <span className="sr-only">{title}</span>
    </span>
  );
}

// REQUESTED is 0…n, not a yes/no: how many guests asked for this profile.
function RequestCountCell({ count }: { count: number }) {
  const n = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
  const title = `${n} guest request${n === 1 ? "" : "s"}`;
  return (
    <span
      className={
        "type-label font-semibold tabular-nums " +
        (n === 0 ? "text-muted-foreground" : "text-foreground")
      }
      title={title}
    >
      {n}
    </span>
  );
}

// Google's OPERATIONAL fact, with the observation date in the tooltip — a
// stale claim must not read as current. Silence from Google is "?", a third
// state that is NOT "closed".
function ActiveCell({
  status,
  seenAt,
}: {
  status: string | null;
  seenAt: string | null;
}) {
  const seen =
    seenAt && !Number.isNaN(new Date(seenAt).getTime())
      ? ` (seen ${new Date(seenAt).toLocaleDateString()})`
      : "";
  if (status === "OPERATIONAL") {
    return (
      <span title={`Google reports this business as open and trading${seen}`}>
        <BoolCell value={true} trueLabel="Yes" falseLabel="No" />
      </span>
    );
  }
  if (status === "CLOSED_TEMPORARILY" || status === "CLOSED_PERMANENTLY") {
    const label =
      status === "CLOSED_TEMPORARILY" ? "Temporarily closed" : "Permanently closed";
    return (
      <span title={`${label}${seen}`}>
        <BoolCell value={false} trueLabel="Yes" falseLabel="No" />
      </span>
    );
  }
  return (
    <span
      title="Google has not reported a business status for this listing yet."
      className="text-muted-foreground type-label font-semibold"
    >
      ?
    </span>
  );
}

// A false cell is not one fact. PIPELINE falses are PENDING — something the
// Intaker or an operator still owes — and read rose. COMMERCIAL falses are a
// STATE: a free place, or a rail this place simply does not accept, is not a
// defect, so they pass `falseTone="neutral"` and read plain grey.
function BoolCell({
  value,
  trueLabel,
  falseLabel,
  accent = false,
  falseTone = "pending" }: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  accent?: boolean;
  falseTone?: "pending" | "neutral";
}) {
  const pill =
    "inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold ";
  if (value) {
    return (
      <span
        className={
          pill +
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
    <span
      className={
        pill +
        (falseTone === "pending"
          ? "bg-rose-500/10 text-rose-700"
          : "text-muted-foreground bg-muted")
      }
    >
      {falseLabel}
    </span>
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
        className="border-border bg-card w-full max-w-md overflow-hidden rounded-2xl border shadow-elev"
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
          <p className="text-muted-foreground type-label font-semibold tracking-[0.14em] uppercase">
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
