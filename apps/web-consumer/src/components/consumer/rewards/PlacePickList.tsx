"use client";

// The New tab (Wallet v3, MESITA-811 · MESITA-817): EVERY Mesita place —
// deliberately no searchbar yet, per Pato ("just list all the places; then we
// see how we can solve the searchbar").
//
// SQUARE TILES, 2 per row (MESITA-1025, Pato: "show squares, not bars"). This
// list does ONE job — pick the place you're standing in — so the photo is the
// content: you recognize the room before you read the name. The whole tile is
// the square (not just its photo), name and zone ride a scrim inside it, so
// the grid keeps one rhythm no matter how long a name runs.
//
// Non-partners are shown, not hidden (MESITA-817). Hiding them meant a guest
// whose catalog is all `web` listings saw an empty tab and concluded the page
// was broken. They get a LOCKED treatment instead (MESITA-819) — padlock pill,
// desaturated photo, no tap target — because consumer-web-create-ticket 409s
// `not_partner`, so a tap is a dead end. Partners sort first.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Lock, MapPin, QrCode, Store } from "lucide-react";

import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function PlacePickList({
  activePlaceIds,
  busyPlaceId = null,
  onPick,
}: {
  /** Places that already hold a live ticket — rows get an "Open" chip. */
  activePlaceIds: ReadonlySet<string>;
  /** Place whose ticket is being created right now — its row shows a spinner. */
  busyPlaceId?: string | null;
  onPick: (place: Place) => void;
}) {
  const supabase = useBrowserSupabase();
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetchPublicPlaces(supabase, 100);
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
  }, [supabase, reloadKey]);

  // Partners first — the rows you can actually act on lead the list.
  const sorted = useMemo(
    () =>
      [...places].sort((a, b) => {
        const ap = a.listing_type === "partner" ? 0 : 1;
        const bp = b.listing_type === "partner" ? 0 : 1;
        return ap !== bp ? ap - bp : a.name.localeCompare(b.name);
      }),
    [places],
  );
  const anyLocked = sorted.some((p) => p.listing_type !== "partner");

  if (status === "loading") {
    // Skeleton mirrors the grid, not a list — a row skeleton resolving into
    // tiles reads as a layout jump.
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-muted aspect-square animate-pulse rounded-2xl border"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
        <p className="text-muted-foreground text-[12.5px]">
          Couldn&apos;t load the places.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setReloadKey((k) => k + 1);
          }}
          className="text-primary text-[12.5px] font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <MapPin className="size-5" />
        </span>
        <p className="text-muted-foreground text-[12.5px]">
          No places on Mesita yet — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3">
        {sorted.map((p) => (
          <li key={p.id} className="min-w-0">
            <PlaceTile
              place={p}
              hasOpen={activePlaceIds.has(p.id)}
              busy={busyPlaceId === p.id}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
      {anyLocked ? (
        <p className="text-muted-foreground/80 px-1 text-[11px] leading-snug">
          Only Verified Partners run the Mesita reward program — the rest are on
          Mesita, but can&apos;t open a ticket yet.
        </p>
      ) : null}
    </div>
  );
}

function PlaceTile({
  place,
  hasOpen,
  busy = false,
  onPick,
}: {
  place: Place;
  hasOpen: boolean;
  busy?: boolean;
  onPick: (place: Place) => void;
}) {
  const isPartner = place.listing_type === "partner";
  const photo = place.photos?.[0] ?? null;
  const subtitle =
    [place.zone, place.category_label ?? place.category]
      .filter(Boolean)
      .join(" · ") || (isPartner ? "Mesita partner" : "On Mesita");

  const body = (
    <>
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 448px) 50vw, 208px"
          // The PHOTO carries the inactive state, not the whole tile — blanket
          // opacity reads as a rendering glitch and costs legibility.
          // Desaturated says "real place, not live".
          className={cn("object-cover", !isPartner && "opacity-70 grayscale")}
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 grid place-items-center",
            isPartner
              ? "bg-pink-gradient text-white/85"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Store className="size-7" />
        </span>
      )}

      {/* Scrim only under the text — a full-tile wash would mute the photo,
          which is the reason the tile is a photo. */}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-2.5 pt-8">
        <span className="font-display block truncate text-[14px] leading-tight font-bold text-white">
          {place.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-white/75">
          {subtitle}
        </span>
      </span>

      {!isPartner ? (
        // One unambiguous locked signal, in one place.
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9.5px] font-extrabold tracking-wide text-white/90 uppercase backdrop-blur">
          <Lock className="size-2.5" />
          Soon
        </span>
      ) : hasOpen ? (
        <span className="bg-primary absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold tracking-wide text-white uppercase">
          Open
        </span>
      ) : (
        // Ghost QR — the tile's promise, made visible. A dashed placeholder
        // reads "your QR comes from here, tap it". Deliberately NOT a
        // scannable code: nothing exists until the ticket is created. While
        // the ticket is being created it becomes the spinner, in place.
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg border border-dashed border-white/50 bg-black/35 text-white backdrop-blur"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <QrCode className="size-4" />
          )}
        </span>
      )}
    </>
  );

  const shell =
    "border-border bg-muted relative block aspect-square w-full overflow-hidden rounded-2xl border text-left";

  // Non-partners are visible but inert: create-ticket would 409 `not_partner`.
  if (!isPartner) {
    return (
      <div aria-disabled="true" className={shell}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(place)}
      className={cn(
        shell,
        "focus-visible:ring-primary transition outline-none focus-visible:ring-2 active:scale-[0.99]",
      )}
    >
      {body}
    </button>
  );
}
