"use client";

// Pay's place list: the closest 50 listed Mesita places around the guest
// (device location, Monterrey fallback). Typing 2+ characters switches to
// Fast Search (Autocomplete) so a place
// that is not in the nearby 50 can still be found. Google Nearby pins are
// Search's map fill, not this list.
//
// One tap creates the ticket. Non-promoting rows stay visible and locked
// (Soon). Live tickets never get an "Open" chip here — they live in Inbox.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Loader2,
  Lock,
  MapPin,
  QrCode,
  SearchX,
  Store,
} from "lucide-react";

import {
  apiFetchNearbyPlaces,
  apiSuggestPlaces,
  type Place,
  type PlacePrediction,
} from "@/lib/api/places";
import { PlacePickListSkeleton } from "@/components/consumer/rewards/place-pick-skeleton";
import { filterPlacesByQuery } from "@/lib/place-list-filter";
import {
  PAY_NEARBY_MAX,
  PAY_SUGGEST_DEBOUNCE_MS,
  PAY_SUGGEST_MIN_CHARS,
  payRowFromPlace,
  payRowFromPrediction,
  type PayListRow,
} from "@/lib/pay-place-list";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { SeedPlace } from "@/lib/ticket-seed";
import { cn } from "@/lib/utils";

export function PlacePickList({
  origin,
  busyPlaceId = null,
  onPick,
  query = "",
  onClearQuery,
}: {
  origin: { lat: number; lng: number };
  busyPlaceId?: string | null;
  onPick: (place: SeedPlace) => void;
  query?: string;
  onClearQuery?: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [suggestFor, setSuggestFor] = useState("");
  const sessionTokenRef = useRef(newSessionToken());
  const trimmed = query.trim();
  const nameSearch = trimmed.length >= PAY_SUGGEST_MIN_CHARS;

  const originLat = origin.lat;
  const originLng = origin.lng;
  const originPoint = useMemo(
    () => ({ lat: originLat, lng: originLng }),
    [originLat, originLng],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetchNearbyPlaces(
          supabase,
          originPoint,
          PAY_NEARBY_MAX,
        );
        if (!cancelled) {
          setPlaces(rows);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, reloadKey, originPoint]);

  useEffect(() => {
    if (!nameSearch) {
      sessionTokenRef.current = newSessionToken();
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
          originPoint,
        );
        if (!cancelled) {
          setPredictions(rows);
          setSuggestFor(trimmed);
        }
      } catch {
        if (!cancelled) {
          setPredictions([]);
          setSuggestFor(trimmed);
        }
      }
    }, PAY_SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [supabase, nameSearch, trimmed, originPoint]);

  const nearbyRows = useMemo(
    () =>
      filterPlacesByQuery(places, nameSearch ? "" : query).map(payRowFromPlace),
    [places, query, nameSearch],
  );
  const searchRows = useMemo(
    () => predictions.map((pred) => payRowFromPrediction(pred, places)),
    [predictions, places],
  );
  const nameResultsReady = nameSearch && suggestFor === trimmed;
  const visible: PayListRow[] = nameSearch
    ? nameResultsReady
      ? searchRows
      : []
    : nearbyRows;
  const anyLocked = visible.some((row) => !row.canStart);
  const showSuggestPending = nameSearch && !nameResultsReady;

  if (status === "loading") {
    return <PlacePickListSkeleton />;
  }

  if (status === "error") {
    return (
      <div className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
        <p className="text-muted-foreground type-body">
          Couldn&apos;t load the places.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setReloadKey((k) => k + 1);
          }}
          className="text-primary type-body font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!nameSearch && places.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <MapPin className="size-5" />
        </span>
        <p className="text-muted-foreground type-body">
          No places on Mesita yet — check back soon.
        </p>
      </div>
    );
  }

  if (showSuggestPending) {
    return <PlacePickListSkeleton />;
  }

  if (visible.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <SearchX className="size-5" />
        </span>
        <p className="text-muted-foreground type-body">
          No place matches{" "}
          <span className="text-foreground font-semibold">{trimmed}</span>.
        </p>
        {onClearQuery ? (
          <button
            type="button"
            onClick={onClearQuery}
            className="text-primary type-body font-semibold"
          >
            Clear search
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        {visible.map((row) => (
          <li key={row.key}>
            <PlaceRow
              row={row}
              busy={busyPlaceId === row.seed?.id}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
      {anyLocked ? (
        <p className="text-muted-foreground/80 type-label px-1 leading-snug">
          Only places running a Mesita reward can open a ticket — the rest
          stay on the list as Soon.
        </p>
      ) : null}
    </div>
  );
}

function PlaceRow({
  row,
  busy = false,
  onPick,
}: {
  row: PayListRow;
  busy?: boolean;
  onPick: (place: SeedPlace) => void;
}) {
  const body = (
    <>
      {row.photo ? (
        <Image
          src={row.photo}
          alt=""
          width={48}
          height={48}
          className={cn(
            "size-12 shrink-0 rounded-xl object-cover",
            !row.canStart && "opacity-60 grayscale",
          )}
        />
      ) : (
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl",
            row.canStart
              ? "bg-secondary/10 text-secondary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Store className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm leading-tight font-bold",
            row.canStart ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {row.name}
        </span>
        <span className="text-muted-foreground/80 mt-0.5 block truncate text-xs">
          {row.subtitle}
        </span>
      </span>
      {!row.canStart ? (
        <span className="bg-muted text-muted-foreground type-meta flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-extrabold tracking-wide uppercase">
          <Lock className="size-2.5" />
          Soon
        </span>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="border-primary/30 bg-primary/5 text-primary/70 grid size-9 shrink-0 place-items-center rounded-lg border border-dashed"
          >
            {busy ? (
              <Loader2 className="size-[18px] animate-spin" />
            ) : (
              <QrCode className="size-[18px]" />
            )}
          </span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </>
      )}
    </>
  );

  if (!row.canStart || !row.seed) {
    return (
      <div
        aria-disabled="true"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        {body}
      </div>
    );
  }

  const seed = row.seed;
  return (
    <button
      type="button"
      onClick={() => onPick(seed)}
      className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-3 text-left transition"
    >
      {body}
    </button>
  );
}
