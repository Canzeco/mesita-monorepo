"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { Screen } from "@/components/consumer/nav/Screen";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import type { PayPlace } from "@/lib/api/wallet";
import { payPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { PlacePhoto } from "./pay-common";
import { distanceText, type Loc, usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";

// /pay/pick — PAY BILL'S PLACE PICKER (Pato, 2026-11-17, MESITA-4232: "GIANT
// BUTTON … WHEN YOU CLICK THAT BUTTON, THEN A MODAL APPEARS FOR YOU TO SELECT
// THE PLACE TO PAY"; a pushed page, not a modal, D3: MESITA-4094 holds). It
// holds what was Pay's own box (MESITA-4204): a search bar always shown
// (MESITA-3725), then the places, every place the guest holds credit at
// pinned first, then the nearest up to PLACES_SHOWN and "Show all". A row
// opens that place's bill (/pay/place/<id>). The location is asked here
// only, after a priming card.
//
// NO BOX (Pato, 2026-11-17, MESITA-4280: "why inside a box … just use a
// searchbar and the places directly display separated by hr"): the search
// bar sits on its own under the header and the rows run edge to edge, a full
// hairline between them; the Panel with its side margins is gone.

/** Places listed before "Show all" (MESITA-3720). */
const PLACES_SHOWN = 5;

export function PayPickPage() {
  const router = useRouter();
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places, failed, refresh } = usePayPlaces(loc.state === "on" ? loc.at : null);
  const [query, setQuery] = useState("");

  return (
    <Screen title="Where are you paying?" paper>
      <div className="-mx-5 -my-5" data-pay-box>
        {/* A REAL FIELD (MESITA-4295, Pato: "better design"): the bare
            SearchBar sits in a 44px grey pill; the list under it stays
            boxless (MESITA-4280). */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-muted flex h-11 items-center rounded-full pr-1 pl-4" data-pay-pick-search>
            <SearchBar
              query={query}
            showClear={query.length > 0}
            onQueryChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Search a place"
            />
          </div>
        </div>
        {places ? (
          <PlaceList
            places={places}
            query={query}
            loc={loc}
            onPick={(id) => navigateTo(router, payPlacePath(id), { motion: "push" })}
            onUseLocation={askLocation}
            onNotNow={notNow}
          />
        ) : failed ? (
          <div className="px-5 py-4">
            <EmptyState
              inline
              icon={QrCode}
              title="Couldn't load the places"
              description="Check your connection and try again."
              action={{ label: "Try again", onClick: refresh }}
            />
          </div>
        ) : (
          <RowsSkeleton />
        )}
      </div>
    </Screen>
  );
}

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function PlaceList({
  places,
  query,
  loc,
  onPick,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  query: string;
  loc: Loc;
  onPick: (placeId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const q = fold(query.trim());
  const [showAll, setShowAll] = useState(false);
  const matches = q ? places.filter((p) => fold(p.name ?? "").includes(q)) : places;
  // Every place the guest holds credit at, at any distance, then the nearest
  // up to PLACES_SHOWN; a search always lists every match.
  const held = matches.filter((p) => p.available_cents > 0);
  const near = matches.filter((p) => p.available_cents <= 0);
  const shown = q || showAll ? matches : [...held, ...near.slice(0, Math.max(0, PLACES_SHOWN - held.length))];
  const hidden = matches.length - shown.length;
  return (
    <div className="flex flex-col">
      {loc.state === "prime" ? (
        <div className="px-5 py-3">
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See places near you that take App Payments
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-11 flex-1 font-semibold" onClick={onUseLocation}>
              Use my location
            </Button>
            <button
              type="button"
              className="border-border bg-card hover:bg-muted min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition"
              onClick={onNotNow}
            >
              Not now
            </button>
          </div>
        </div>
      ) : loc.state === "blocked" ? (
        <p className="text-muted-foreground px-5 py-2 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            inline
            icon={MapPin}
            title={
              loc.state === "on"
                ? "No place near you takes App Payments"
                : "Turn on location to see places near you that take App Payments"
            }
            description=""
          />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        // SECTIONS (MESITA-4295): the places you hold credit at, then the
        // nearest; a search is one list. The rows run edge to edge
        // (MESITA-4280) with a hairline between them.
        <div data-pay-places>
          {q ? (
            <Section title="Results" places={shown} onPick={onPick} />
          ) : (
            <>
              <Section title="Your cards" places={shown.filter((p) => p.available_cents > 0)} onPick={onPick} />
              <Section title="Near you" places={shown.filter((p) => p.available_cents <= 0)} onPick={onPick} />
            </>
          )}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="border-border hover:bg-muted/60 flex min-h-12 w-full items-center justify-center border-t px-5 text-sm font-semibold transition"
            >
              Show all {matches.length} places
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One eyebrow and its rows; none, nothing. */
function Section({ title, places, onPick }: { title: string; places: PayPlace[]; onPick: (placeId: string) => void }) {
  if (places.length === 0) return null;
  return (
    <section className="mt-3">
      <p className="type-eyebrow text-muted-foreground px-5 pb-2">{title}</p>
      <div className="border-border divide-border divide-y border-y">
        {places.map((p) => (
          <PlaceRow key={p.place_id} p={p} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

/** A place: photo, name, "1.0 km · address", then the QR chip and a chevron. */
function PlaceRow({ p, onPick }: { p: PayPlace; onPick: (placeId: string) => void }) {
  const line = [p.distance_m !== null ? distanceText(p.distance_m) : null, p.address].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      className="hover:bg-muted/60 flex min-h-[4.5rem] w-full items-center gap-3.5 px-5 py-3 text-left transition"
    >
      <PlacePhoto place={p} className="h-12 w-12" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{p.name ?? "A Mesita place"}</span>
        {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm tabular-nums">{line}</span> : null}
      </span>
      {/* THE QR (MESITA-4242, Pato: "a fictional qr at the right"): white on
          a black chip (MESITA-4251). */}
      <span className="flex h-8 w-[3.2rem] shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white" aria-hidden data-pay-pick-qr>
        <QrCode className="h-5 w-5" strokeWidth={2} />
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
}

function RowsSkeleton() {
  return (
    <div className="mt-3" aria-busy>
      <Skeleton className="mx-5 mb-2 h-3 w-20" />
      <div className="border-border divide-border divide-y border-y">
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          <div className="flex min-h-[4.5rem] items-center gap-3 px-5 py-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        </Fragment>
      ))}
      </div>
    </div>
  );
}

/** /pay/pick's loading frame: the header, the search bar's shape, rows. */
export function PayPickLoading() {
  return (
    <Screen title="Where are you paying?" paper>
      <div className="-mx-5 -my-5" aria-busy>
        <div className="px-5 pt-4 pb-2">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
        <RowsSkeleton />
      </div>
    </Screen>
  );
}
