"use client";

// Pay's place list: the closest 50 listed Mesita places around the guest
// (device location, Monterrey fallback). Typing 2+ characters switches to
// the MESITA NAME EMBEDDINGS (`mode: "mesita"`) so a place that is not in
// the nearby 50 can still be found by name.
//
// Deliberately NOT Autocomplete (Pato, 2026-08-29): Pay opens a ticket,
// and a ticket can only open at a place that is on Mesita, so a Google
// lane would bill an API call to return a row this list must immediately
// lock. Google Nearby pins are Search's map fill, not this list.
//
// One tap creates the ticket. Live tickets never get an "Open" chip here —
// they live in Inbox.
//
// THE PER-ROW SOON BADGE IS GONE (Pato, 2026-09-01: "remove the shit that
// leaves there"). Every row carried it, in grayscale, above a footnote saying
// the same thing a third time — and a badge the majority of rows share
// distinguishes nothing, it just spends the list's whole visual budget
// repeating the base state. The signal now sits on the EXCEPTION: places you
// can actually pay get one pink "Pay here" chip and sort to the top, and
// everything else is a plain, full-colour row.
//
// A ROW THAT CANNOT START STILL ANSWERS A TAP. Dropping the badge without
// this would leave a guest standing in a Subway tapping a dead div — which
// reads as a broken app, and is worse than the badge. One toast, at the moment
// of the tap, is the whole explanation: brief, timely, unavoidable, and it
// costs the list nothing at rest. It is a <button> now rather than an
// aria-disabled <div>, so a keyboard can reach it at all.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Loader2,
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
  sortPayableFirst,
  type PayListRow,
} from "@/lib/pay-place-list";
import { toast } from "@/lib/toast";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { SeedPlace } from "@/lib/ticket-seed";

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
        // Pay's engine is the Mesita NAME EMBEDDINGS (Pato, 2026-08-29).
        // Not Autocomplete: a ticket can only open at a place that is on
        // Mesita, so a Google lane would bill a call to return a row this
        // list must immediately lock.
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
          originPoint,
          "mesita",
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
      sortPayableFirst(
        filterPlacesByQuery(places, nameSearch ? "" : query).map(
          payRowFromPlace,
        ),
      ),
    [places, query, nameSearch],
  );
  const searchRows = useMemo(
    () =>
      sortPayableFirst(
        predictions.map((pred) => payRowFromPrediction(pred, places)),
      ),
    [predictions, places],
  );
  const nameResultsReady = nameSearch && suggestFor === trimmed;
  const visible: PayListRow[] = nameSearch
    ? nameResultsReady
      ? searchRows
      : []
    : nearbyRows;
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
  const payable = row.canStart && !!row.seed;

  return (
    <button
      type="button"
      onClick={() => {
        if (row.seed) {
          onPick(row.seed);
          return;
        }
        // The one place this is ever explained, said once, when it matters.
        toast(`${row.name} isn't on Mesita Pay yet.`);
      }}
      className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-3 text-left transition"
    >
      {/* Full colour either way. The grayscale treatment here used to mark a
          non-payable row, which meant most of the list rendered as a dead
          catalogue of places the guest could see were real. */}
      {row.photo ? (
        <Image
          src={row.photo}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="bg-secondary/10 text-secondary grid size-12 shrink-0 place-items-center rounded-xl">
          <Store className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm leading-tight font-bold">
          {row.name}
        </span>
        <span className="text-muted-foreground/80 mt-0.5 block truncate text-xs">
          {row.subtitle}
        </span>
      </span>
      {payable ? (
        <>
          <span className="bg-pink-gradient shadow-glow-sm type-meta flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-extrabold tracking-wide text-white uppercase">
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <QrCode className="size-3" />
            )}
            Pay here
          </span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </>
      ) : null}
    </button>
  );
}
