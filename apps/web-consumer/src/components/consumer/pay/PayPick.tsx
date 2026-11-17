"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { Screen } from "@/components/consumer/nav/Screen";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import type { PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
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

/** Places listed before "Show all" (MESITA-3720). */
const PLACES_SHOWN = 5;

export function PayPickPage() {
  const router = useRouter();
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places, failed, refresh } = usePayPlaces(loc.state === "on" ? loc.at : null);
  const [query, setQuery] = useState("");

  return (
    <Screen title="Where are you paying?" paper>
      <Panel className="mt-1" data-pay-box>
        <div className="px-4 pt-4 pb-1">
          <SearchBar
            query={query}
            showClear={query.length > 0}
            onQueryChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search a place"
          />
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
          <div className="p-4">
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
      </Panel>
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
        <div className="px-4 py-3">
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
        <p className="text-muted-foreground px-4 py-2 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <div className="p-4">
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
        <p className="text-muted-foreground px-4 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        // The rows run edge to edge inside the box (MESITA-4204): a hairline
        // above each, never a box of their own.
        <div className="mt-2" data-pay-places>
          {shown.map((p, i) => (
            <Fragment key={p.place_id}>
              <div className={cn("bg-border h-px", i > 0 && "ml-[4.5rem]")} />
              <button
                type="button"
                onClick={() => onPick(p.place_id)}
                className="hover:bg-muted/60 flex min-h-[4.75rem] w-full items-center gap-3.5 px-4 py-3 text-left transition"
              >
                <PlacePhoto place={p} className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{p.name ?? "A Mesita place"}</span>
                  {p.address ? (
                    <span className="text-muted-foreground mt-0.5 block truncate text-sm">{p.address}</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                  {p.distance_m !== null ? distanceText(p.distance_m) : null}
                  {/* THE QR (Pato, 2026-11-17, MESITA-4242: "a fictional qr at
                      the right … like you are about to generate a qr"): the
                      row starts a bill, as Pay Bill's own QR says. */}
                  <QrCode className="text-foreground h-6 w-6" strokeWidth={2} aria-hidden data-pay-pick-qr />
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </Fragment>
          ))}
          {hidden > 0 ? (
            <>
              <div className="bg-border h-px" />
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="hover:bg-muted/60 flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold transition"
              >
                Show all {matches.length} places
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="mt-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-[4.75rem] items-center gap-3 px-4 py-3">
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
  );
}

/** /pay/pick's loading frame: the header, the search bar's shape, rows. */
export function PayPickLoading() {
  return (
    <Screen title="Where are you paying?" paper>
      <Panel className="mt-1" aria-busy>
        <div className="px-4 pt-4 pb-1">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
        <RowsSkeleton />
      </Panel>
    </Screen>
  );
}
