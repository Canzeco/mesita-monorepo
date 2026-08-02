"use client";

// The New tab (Wallet v3, MESITA-811): every Mesita partner, listed flat —
// deliberately no searchbar yet, per Pato ("just list all the places; then we
// see how we can solve the searchbar"). Tapping a row opens the venue pass
// modal, which reuses or creates the ticket. Only Verified Partners render:
// the create EF 409s anything else (not_partner), so other rows would be
// dead ends.

import { useEffect, useState } from "react";
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
          setPlaces(rows.filter((p) => p.listing_type === "partner"));
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

  if (places.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <MapPin className="size-5" />
        </span>
        <p className="text-muted-foreground text-[12.5px]">
          No partner places yet — check back soon.
        </p>
      </div>
    );
  }

  return (
    <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
      {places.map((p) => {
        const hasOpen = activePlaceIds.has(p.id);
        const photo = p.photos?.[0] ?? null;
        const subtitle =
          [p.zone, p.category_label ?? p.category].filter(Boolean).join(" · ") ||
          "Mesita partner";
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-3 text-left transition"
            >
              {photo ? (
                <Image
                  src={photo}
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
                <span className="text-foreground block truncate text-[13.5px] leading-tight font-bold">
                  {p.name}
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
                  {subtitle}
                </span>
              </span>
              {hasOpen ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase",
                    "bg-primary/10 text-primary",
                  )}
                >
                  Open
                </span>
              ) : (
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
