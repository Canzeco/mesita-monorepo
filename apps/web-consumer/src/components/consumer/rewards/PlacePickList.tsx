"use client";

// The New tab (Wallet v3, MESITA-811 · MESITA-817): EVERY Mesita place, listed
// flat — deliberately no searchbar yet, per Pato ("just list all the places;
// then we see how we can solve the searchbar").
//
// Non-partners are shown, not hidden (MESITA-817). Hiding them meant a guest
// whose catalog is all `web` listings saw an empty tab and concluded the page
// was broken. They render dimmed and untappable instead, because
// consumer-web-create-ticket 409s `not_partner` — a tap would be a dead end.
// Partners sort first.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, MapPin, Store } from "lucide-react";

import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function PlacePickList({
  activePlaceIds,
  onPick,
}: {
  /** Places that already hold a live ticket — rows get an "Open" chip. */
  activePlaceIds: ReadonlySet<string>;
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
    return (
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <div className="bg-muted size-12 animate-pulse rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-3.5 w-2/5 animate-pulse rounded" />
              <div className="bg-muted h-3 w-3/5 animate-pulse rounded" />
            </div>
          </div>
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
    <div className="flex flex-col gap-2">
      <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
        {sorted.map((p) => (
          <li key={p.id}>
            <PlaceRow
              place={p}
              hasOpen={activePlaceIds.has(p.id)}
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

function PlaceRow({
  place,
  hasOpen,
  onPick,
}: {
  place: Place;
  hasOpen: boolean;
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
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl",
            isPartner
              ? "bg-secondary/10 text-secondary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Store className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13.5px] leading-tight font-bold">
          {place.name}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
          {subtitle}
        </span>
      </span>
      {!isPartner ? (
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
          Soon
        </span>
      ) : hasOpen ? (
        <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
          Open
        </span>
      ) : (
        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
      )}
    </>
  );

  // Non-partners are visible but inert: create-ticket would 409 `not_partner`.
  if (!isPartner) {
    return (
      <div
        aria-disabled="true"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left opacity-55"
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(place)}
      className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-3 text-left transition"
    >
      {body}
    </button>
  );
}
