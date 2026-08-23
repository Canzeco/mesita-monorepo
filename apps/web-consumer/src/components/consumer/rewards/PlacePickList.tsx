"use client";

// The New tab (Wallet v3, MESITA-811 · MESITA-817): EVERY Mesita place, listed
// flat, narrowed by the header's search field (MESITA-1071 — Pato: "replace
// that with a searchbar", the answer to the deferred "then we see how we can
// solve the searchbar").
//
// The field is OWNED BY THE HEADER (NewVisitClient) because it renders outside
// this scroll body; the query arrives as a prop and the matching happens here,
// where the rows already live. Matching is client-side on purpose: the list is
// capped at 100 rows and is already fully in memory, so a per-keystroke EF
// round-trip would be slower and buy nothing.
//
// ROWS, one column (Pato, 2026-08-11: "no squares neither — you only see
// places, step 1"). This reverses MESITA-1025's 2-col square grid: squares put
// the photo first, but this list does not sell a place — you are already
// standing in it, and you are scanning for its NAME. A name is what a row
// reads first, at full width, unabbreviated.
//
// ONE TAP IS THE WHOLE INTERACTION: tapping a partner creates the ticket and
// lands on THE TICKET (/visit/[id]). No wizard, no confirm — hence
// the ghost QR on every actionable row, which is the row's promise made
// visible.
//
// Non-partners are shown, not hidden (MESITA-817). Hiding them meant a guest
// whose catalog is all `web` listings saw an empty tab and concluded the page
// was broken. They get a LOCKED treatment instead (MESITA-819) — padlock pill,
// desaturated thumbnail, muted name, no tap target — because
// consumer-web-create-ticket 409s `not_partner`, so a tap is a dead end.
// Partners sort first.

import { useEffect, useMemo, useState } from "react";
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

import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { PlacePickListSkeleton } from "@/components/consumer/rewards/place-pick-skeleton";
import { filterPlacesByQuery } from "@/lib/place-list-filter";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function PlacePickList({
  activePlaceIds,
  busyPlaceId = null,
  onPick,
  query = "",
  onClearQuery,
}: {
  /** Places that already hold a live ticket — rows get an "Open" chip. */
  activePlaceIds: ReadonlySet<string>;
  /** Place whose ticket is being created right now — its row shows a spinner. */
  busyPlaceId?: string | null;
  onPick: (place: Place) => void;
  /** Header search query. Empty string = show everything. */
  query?: string;
  /** Lets the no-match state clear the field it cannot reach itself. */
  onClearQuery?: () => void;
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
  // Rules and rationale live with the matcher in `@/lib/place-list-filter`, where
  // they are unit-tested; this only decides WHEN to apply them.
  const visible = useMemo(
    () => filterPlacesByQuery(sorted, query),
    [sorted, query],
  );

  // Scoped to what is ON SCREEN: the partner footnote explains locked rows, so
  // it has no business showing when the query has filtered them all away.
  const anyLocked = visible.some((p) => p.listing_type !== "partner");

  if (status === "loading") {
    return <PlacePickListSkeleton />;
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

  // A query that matches nothing is NOT an empty catalog, and saying "no
  // places on Mesita yet" to someone who simply mistyped is a lie the guest
  // has no way to disprove — the field that caused it lives in the header,
  // out of this component's reach, so the way out ships with the message.
  if (visible.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <SearchX className="size-5" />
        </span>
        <p className="text-muted-foreground text-[12.5px]">
          No place matches{" "}
          <span className="text-foreground font-semibold">{query.trim()}</span>.
        </p>
        {onClearQuery ? (
          <button
            type="button"
            onClick={onClearQuery}
            className="text-primary text-[12.5px] font-semibold"
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
        {visible.map((p) => (
          <li key={p.id}>
            <PlaceRow
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
          Only Mesita Partners run the Mesita reward program — the rest are on
          Mesita, but can&apos;t open a ticket yet.
        </p>
      ) : null}
    </div>
  );
}

function PlaceRow({
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
          width={48}
          height={48}
          // The THUMBNAIL carries the inactive state, not the whole row —
          // blanket row opacity reads as a rendering glitch and costs
          // legibility. Desaturated + dimmed says "real place, not live".
          className={cn(
            "size-12 shrink-0 rounded-xl object-cover",
            !isPartner && "opacity-60 grayscale",
          )}
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
        <span
          className={cn(
            "block truncate text-[13.5px] leading-tight font-bold",
            isPartner ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {place.name}
        </span>
        <span className="text-muted-foreground/80 mt-0.5 block truncate text-[11.5px]">
          {subtitle}
        </span>
      </span>
      {!isPartner ? (
        // One unambiguous locked signal, in one place.
        <span className="bg-muted text-muted-foreground flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
          <Lock className="size-2.5" />
          Soon
        </span>
      ) : hasOpen ? (
        // The one place-row state worth showing: this place already holds a
        // live ticket, so the tap re-opens it instead of making a second one.
        <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
          Open
        </span>
      ) : (
        <>
          {/* Ghost QR — the row's promise, made visible. A dashed placeholder
              reads "your QR comes from here, tap it", which a bare chevron
              never says. Deliberately NOT a scannable code: nothing exists
              until the ticket is created. While the ticket is being created
              it becomes the spinner, in place. */}
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

  // Non-partners are visible but inert: create-ticket would 409 `not_partner`.
  if (!isPartner) {
    return (
      <div
        aria-disabled="true"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
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
