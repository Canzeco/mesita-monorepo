"use client";

import { Fragment, useState } from "react";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import type { PayPlace } from "@/lib/api/wallet";
import { PlacePhoto } from "./pay-common";
import { distanceText, type Loc, usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";

// PAY BILL'S PLACE PICKER (Pato, 2026-11-17, MESITA-4232: "WHEN YOU CLICK
// THAT BUTTON, THEN A MODAL APPEARS"; MESITA-4478: it rises from the bottom
// over the wallet). It holds what was Pay's own box (MESITA-4204): a search
// bar always shown (MESITA-3725), then the places, every place the guest
// holds credit at pinned first, then the nearest up to PLACES_SHOWN and
// "Show all". A row opens that place's bill (/pay/place/<id>), which stays
// a page. The location is asked here only, after a priming card, and only
// while the sheet is open.
//
// NO BOX (Pato, 2026-11-17, MESITA-4280: "why inside a box … just use a
// searchbar and the places directly display separated by hr"): the search
// bar sits on its own under the header and the rows run edge to edge, a full
// hairline between them; the Panel with its side margins is gone.

// PREPAY & GET CREDITS USES IT TOO (Pato, 2026-11-21, MESITA-4597: "searchbar
// at the top and then just display first the 3 closest places. then display
// the list of all the loyalty cards you already have … don't display current
// balance. Just display name of the place and location and card. when you
// click the place, then you open its offers page"): `PlacePickBody` with
// `prepay` is /wallet/buy's whole body: no "Where are you paying?", only
// places that sell credits, "Near you" (the 3 closest) then "Your Loyalty
// Cards" (every place the guest holds credit at, not already above), each
// row the card-shaped photo, the name and the location line, no QR chip and
// no "Show all"; a search lists every match.

/** Places listed before "Show all" (MESITA-3720). */
const PLACES_SHOWN = 5;

export function PayPickSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (placeId: string) => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} from="bottom" fit ariaLabel="Where are you paying?">
      {open ? <PayPickBody onPick={onPick} /> : null}
    </LocalSheet>
  );
}

function PayPickBody({ onPick }: { onPick: (placeId: string) => void }) {
  return <PlacePickBody onPick={onPick} />;
}

/** /wallet/buy's prepay count: the closest places listed first (MESITA-4597). */
const NEAR_SHOWN = 3;

export function PlacePickBody({ onPick, prepay = false }: { onPick: (placeId: string) => void; prepay?: boolean }) {
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places: all, failed, refresh } = usePayPlaces(loc.state === "on" ? loc.at : null);
  const places = prepay && all ? all.filter((p) => p.card_ok) : all;
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-box>
      {prepay ? null : <p className="px-5 pt-1 text-base font-semibold">Where are you paying?</p>}
      {/* A REAL FIELD (MESITA-4295, Pato: "better design"): the bare
          SearchBar sits in a 44px grey pill; the list under it stays
          boxless (MESITA-4280). It is not focused on open (MESITA-2939). */}
      <div className="px-5 pt-3 pb-2">
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {places ? (
          <PlaceList
            places={places}
            query={query}
            loc={loc}
            onPick={onPick}
            onUseLocation={askLocation}
            onNotNow={notNow}
            prepay={prepay}
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
    </div>
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
  prepay = false,
}: {
  prepay?: boolean;
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
  const hidden = prepay ? 0 : matches.length - shown.length;
  const holds = (p: PayPlace) => p.available_cents > 0 || p.pending_cents > 0;
  const nearest = matches.slice(0, NEAR_SHOWN);
  const nearIds = new Set(nearest.map((p) => p.place_id));
  const cards = matches.filter((p) => holds(p) && !nearIds.has(p.place_id));
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
            <Section title="Results" places={prepay ? matches : shown} onPick={onPick} prepay={prepay} />
          ) : prepay ? (
            <>
              <Section title="Near you" places={nearest} onPick={onPick} prepay />
              <Section title="Your Loyalty Cards" places={cards} onPick={onPick} prepay />
            </>
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
function Section({
  title,
  places,
  onPick,
  prepay = false,
}: {
  title: string;
  places: PayPlace[];
  onPick: (placeId: string) => void;
  prepay?: boolean;
}) {
  if (places.length === 0) return null;
  return (
    <section className="mt-3">
      <p className="type-eyebrow text-muted-foreground px-5 pb-2">{title}</p>
      <div className="border-border divide-border divide-y border-y">
        {places.map((p) => (
          <PlaceRow key={p.place_id} p={p} onPick={onPick} prepay={prepay} />
        ))}
      </div>
    </section>
  );
}

/** A place: photo, name, "1.0 km · address", then the QR chip and a chevron. */
function PlaceRow({ p, onPick, prepay = false }: { p: PayPlace; onPick: (placeId: string) => void; prepay?: boolean }) {
  const line = [p.distance_m !== null ? distanceText(p.distance_m) : null, p.address].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      className="hover:bg-muted/60 flex min-h-[4.5rem] w-full items-center gap-3.5 px-5 py-3 text-left transition"
    >
      {/* The Loyalty Card's shape on Prepay (MESITA-4597: "name … location
          and card"): Pay's 48x32 card thumbnail; the bill picker keeps its circle. */}
      <PlacePhoto place={p} className={prepay ? "h-8 w-12 rounded-md" : "h-12 w-12"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{p.name ?? "A Mesita place"}</span>
        {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm tabular-nums">{line}</span> : null}
      </span>
      {/* THE QR (MESITA-4242, Pato: "a fictional qr at the right"): white on
          a black chip (MESITA-4251). */}
      {prepay ? null : (
        <span className="flex h-8 w-[3.2rem] shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white" aria-hidden data-pay-pick-qr>
          <QrCode className="h-5 w-5" strokeWidth={2} />
        </span>
      )}
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
