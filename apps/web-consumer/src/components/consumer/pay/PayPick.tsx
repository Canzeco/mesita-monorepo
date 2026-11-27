"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MapPin, QrCode, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";
import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { BAR } from "@/components/consumer/search/header-classes";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { voucherPct } from "@mesita/place-profile/lib/offers";
import { EFError } from "@/lib/api/_invoke";
import { apiSuggestPlacesWithIdle, type PlacePrediction } from "@/lib/api/places";
import { payPlaceCashbackBps, payPlaceDiscountBps, type PayPlace } from "@/lib/api/wallet";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { PlacePhoto } from "./pay-common";
import type { Loc } from "./pay-location";

// THE WALLET'S TWO PLACE LISTS (MESITA-4838, Pato: "if i select prepay, then
// the box below displays all the prepay options ... if i select pay, then i
// see places to select below"): a search box and the places, in the menu's
// box. Prepay lists every Mesita place, nearest first. All places includes
// the ones that sell nothing. A column they do not sell is a gray dash
// (MESITA-4989): the same mark in any language, not a 0% bonus. A row
// opens its Offers. Pay lists every place, the ones the guest
// holds credit at first, with what their next bill gets; a
// row opens the one QR with that place over it. The reads and the location
// are PayPage's, shared by both. They were a sheet (MESITA-4232), /wallet/buy
// (MESITA-4597), Nearby Offers (MESITA-4765) and /pay/pick (MESITA-4837).

type ListKind = "prepay" | "pay";

/** Closest uses the location in this modal. Best offers is a sum on Prepay
 *  and this guest's next-bill percent on Pay (MESITA-4973). */
type SortId = "closest" | "best";

/** Prepay is binary. Pay is all places, or the ones with a discount.
 *  Cashback is hidden for now (Pato, 2026-11-26). */
type ShowId = "all" | "one" | "discount";

const VOUCHERS_SHOWN = ["voucher_200", "voucher_1000", "voucher_5000"] as const;

const SORTS: { id: SortId; label: string }[] = [
  { id: "closest", label: "Closest" },
  { id: "best", label: "Best offers" },
];

const PREPAY_SHOWS: { id: ShowId; label: string }[] = [
  { id: "all", label: "All places" },
  { id: "one", label: "Sells a prepayment" },
];

const PAY_SHOWS: { id: ShowId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "discount", label: "Extra discount" },
];

/** At least one of the three prepayments ($200, $1,000, $5,000). */
function sellsOneVoucher(p: PayPlace): boolean {
  return VOUCHERS_SHOWN.some((k) => p.offers?.sell.includes(k) === true);
}

/** Prepay: the three bonuses added. Pay: this guest's discount percent.
 *  Cashback does not rank a row while it is hidden. */
function offerScore(p: PayPlace, kind: ListKind): number {
  if (kind === "prepay") {
    return VOUCHERS_SHOWN.reduce((sum, k) => {
      if (!p.offers?.sell.includes(k)) return sum;
      return sum + Math.max(0, voucherPct(p.offers, k) || 0);
    }, 0);
  }
  return payPlaceDiscountBps(p);
}

function byDistance(a: PayPlace, b: PayPlace): number {
  return (a.distance_m ?? Number.POSITIVE_INFINITY) - (b.distance_m ?? Number.POSITIVE_INFINITY);
}

function passesShow(p: PayPlace, kind: ListKind, show: ShowId): boolean {
  if (show === "all") return true;
  if (kind === "prepay") return show === "one" && sellsOneVoucher(p);
  if (show === "discount") return payPlaceDiscountBps(p) > 0;
  return false;
}

function orderPlaces(list: PayPlace[], kind: ListKind, sort: SortId): PayPlace[] {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const score = sort === "best" ? offerScore(b.p, kind) - offerScore(a.p, kind) : 0;
      return score || byDistance(a.p, b.p) || a.i - b.i;
    })
    .map(({ p }) => p);
}

function FilterChoice({ on, label, onPick }: { on: boolean; label: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={cn("flex h-12 w-full items-center justify-between rounded-xl px-3 text-left text-base font-semibold", on && "bg-muted")}
    >
      {label}
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", on ? "bg-foreground" : "border-border border")} aria-hidden />
    </button>
  );
}

/** Location, then sort, then what to show. Prepay and Pay share the shell. */
function ListFilters({
  kind,
  open,
  sort,
  show,
  onSort,
  onShow,
  onClose,
}: {
  kind: ListKind;
  open: boolean;
  sort: SortId;
  show: ShowId;
  onSort: (id: SortId) => void;
  onShow: (id: ShowId) => void;
  onClose: () => void;
}) {
  const options = kind === "prepay" ? PREPAY_SHOWS : PAY_SHOWS;
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Filters" fit>
      <div className="border-border flex h-14 shrink-0 items-center border-b pr-1.5 pl-5">
        <h2 className="flex-1 text-base font-semibold">Filters</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl">
          <X className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 py-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-sm font-semibold">Location</h3>
          <LocationPicker wide />
        </section>
        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground px-1 text-sm font-semibold">Sort</h3>
          {SORTS.map((o) => (
            <FilterChoice key={o.id} on={sort === o.id} label={o.label} onPick={() => onSort(o.id)} />
          ))}
        </section>
        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground px-1 text-sm font-semibold">Show</h3>
          {options.map((o) => (
            <FilterChoice key={o.id} on={show === o.id} label={o.label} onPick={() => onShow(o.id)} />
          ))}
        </section>
      </div>
    </LocalDialog>
  );
}

export function PlaceList({
  kind,
  places: all,
  failed,
  loc,
  onUseLocation,
  onNotNow,
  onRefresh,
  onPick,
}: {
  kind: ListKind;
  /** Nearest first; null while they load. */
  places: PayPlace[] | null;
  failed: boolean;
  loc: Loc;
  onUseLocation: () => void;
  onNotNow: () => void;
  onRefresh: () => void;
  onPick: (placeId: string) => void;
}) {
  const supabase = useBrowserSupabase();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortId>("closest");
  const [show, setShow] = useState<ShowId>("all");
  const [hits, setHits] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const tokenRef = useRef(newSessionToken());
  const idleRef = useRef(1000);
  const trimmed = query.trim();
  const querying = trimmed.length >= 2;
  const lat = loc.state === "on" ? loc.at.lat : null;
  const lng = loc.state === "on" ? loc.at.lng : null;
  const places = all;
  const matches = (places ?? []).filter((p) => passesShow(p, kind, show));
  const shown = orderPlaces(matches, kind, sort);
  const filtersOn = sort !== "closest" || show !== "all";

  function changeQuery(next: string) {
    setQuery(next);
    if (next.trim().length >= 2) setSearching(true);
    else {
      setSearching(false);
      setHits([]);
      setSearchError(null);
      tokenRef.current = newSessionToken();
    }
  }

  useEffect(() => {
    if (!querying) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const { predictions, idleSec } = await apiSuggestPlacesWithIdle(
          supabase,
          trimmed,
          tokenRef.current,
          lat !== null && lng !== null ? { lat, lng } : null,
          "fast",
        );
        if (idleSec !== null) idleRef.current = Math.round(idleSec * 1000);
        if (cancelled) return;
        setHits(predictions.filter((p) => p.kind !== "location"));
        setSearchError(null);
      } catch (err) {
        if (cancelled) return;
        setHits([]);
        setSearchError(err instanceof EFError && err.status === 502 ? "Search is unavailable right now." : "Search failed. Try again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, idleRef.current);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [querying, trimmed, supabase, lat, lng]);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-list={kind}>
      {/* SEARCH, THEN FILTERS, THEN THE LIST (Pato, 2026-11-25, MESITA-4973).
          An empty bar is the nearby table. Typing searches every place
          (MESITA-4975). Filters hold the location, Closest or Best offers,
          and what the table shows. The controls share the title's 16px inset
          (MESITA-4978). The column bar stays full width. */}
      <div className="border-border bg-card flex shrink-0 flex-col gap-2 border-b px-4 pt-3 pb-3">
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-2">
          <div className={cn(BAR, "h-12 w-full")} data-pay-pick-search>
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={changeQuery}
              onClear={() => changeQuery("")}
              placeholder="Search a place"
              label="Search a place"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            className={cn(
              "flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 text-sm font-semibold transition",
              filtersOn ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-border",
            )}
            data-pay-filters
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Filters
          </button>
        </div>
        <ListFilters
          kind={kind}
          open={filtersOpen}
          sort={sort}
          show={show}
          onSort={setSort}
          onShow={setShow}
          onClose={() => setFiltersOpen(false)}
        />
      </div>
      {/* FOR THE MOMENT (Pato, 2026-11-26, MESITA-5005): a yellow warning between the title and the black column bar, on Prepay and on Pay. */}
      <p className="flex shrink-0 items-start gap-2 border-b border-amber-400 bg-amber-200 px-4 py-3 text-sm font-semibold text-amber-950" data-pay-test-banner>
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span>Test mode. No real money is moving, and the offers are fake.</span>
      </p>
      <section className="mb-[max(0.5rem,env(safe-area-inset-bottom))] flex min-h-0 flex-1 flex-col" aria-label="Places" data-pay-list-box>
      <div className="bg-card text-foreground flex min-h-0 flex-1 flex-col overflow-hidden">
      <KeptScroll className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {loc.state === "prime" ? (
        <div className="border-border border-b px-3.5 py-3">
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See places near you
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
        <p className="text-muted-foreground border-border border-b px-3.5 py-3 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}
      {querying ? (
        <SearchHits hits={hits} searching={searching} error={searchError} query={trimmed} onPick={onPick} />
      ) : places === null && failed ? (
        <div className="px-3.5 py-4">
          <EmptyState
            inline
            icon={QrCode}
            title="Couldn't load the places"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: onRefresh }}
          />
        </div>
      ) : places === null || (loc.state === "asking" && places.length === 0) ? (
        <RowsSkeleton kind={kind} />
      ) : places.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">
          {loc.state !== "on" ? "Turn on location to see places near you" : "No Mesita place near you"}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">
          No place matches this filter
        </p>
      ) : (
        // A PLACE TABLE (Pato, 2026-11-24, MESITA-4844: "this looks like three
        // different buttons ... it must look like place selector"): one row
        // per place, one tap; plain columns, no boxes.
        <div data-pay-places>
          {kind === "prepay" ? (
            <div className={cn(PREPAY_GRID, HEAD_BAR, "h-11")} aria-hidden data-pay-head-row>
              <span className="pl-2.5 text-base max-[374px]:text-sm">Place</span>
              {PREPAY_HEADS.map((h) => (
                <span key={h} className="text-center text-base tabular-nums max-[374px]:text-sm">
                  {h}
                </span>
              ))}
              <span />
            </div>
          ) : (
            <div className={cn(PAY_GRID, HEAD_BAR, "min-h-11 py-1.5")} aria-hidden data-pay-head-row>
              <span className="pl-4 text-base max-[374px]:text-sm">Place</span>
              <span className={PAY_OFFERS}>
                <span className="text-center leading-tight">
                  Accepts
                  <br />
                  Credits
                </span>
              </span>
            </div>
          )}
          <div className="divide-border border-border divide-y border-b">
            {shown.map((p) => (
              <PlaceRow key={p.place_id} p={p} onPick={onPick} kind={kind} />
            ))}
          </div>
        </div>
      )}
      </KeptScroll>
      </div>
      </section>
    </div>
  );
}

/** The typed bar (MESITA-4975): every place, not the nearby table. A Mesita
 *  row opens. A Google-only row stays, with a mark and no way to add it. */
function SearchHits({
  hits,
  searching,
  error,
  query,
  onPick,
}: {
  hits: PlacePrediction[];
  searching: boolean;
  error: string | null;
  query: string;
  onPick: (placeId: string) => void;
}) {
  if (searching && hits.length === 0) return <RowsSkeleton kind="pay" />;
  if (error && hits.length === 0) return <p className="text-muted-foreground px-3.5 py-4 text-sm">{error}</p>;
  if (hits.length === 0) {
    return <p className="text-muted-foreground px-3.5 py-4 text-sm">No place matches &ldquo;{query}&rdquo;</p>;
  }
  return (
    <div className="divide-border border-border divide-y border-b" data-pay-search-hits>
      {hits.map((hit) => (
        <SearchHit key={hit.placeId || hit.mesitaId} hit={hit} onPick={onPick} />
      ))}
    </div>
  );
}

function hitPhoto(hit: PlacePrediction): string | null {
  const card = hit.card;
  const candidates = [card?.profile_photo, ...(Array.isArray(card?.photos) ? card.photos : [])];
  for (const src of candidates) {
    if (typeof src === "string" && src.startsWith("https://")) return src;
  }
  return null;
}

function SearchHit({ hit, onPick }: { hit: PlacePrediction; onPick: (placeId: string) => void }) {
  const onMesita = Boolean(hit.mesitaId);
  const row = (
    <>
      <PlacePhoto place={{ photo: hitPhoto(hit), name: hit.mainText }} className="h-12 w-12" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{hit.mainText}</span>
        {hit.secondaryText ? <span className="text-muted-foreground block truncate text-sm">{hit.secondaryText}</span> : null}
      </span>
      {onMesita ? null : (
        <span className="type-label bg-muted text-muted-foreground shrink-0 rounded-xl px-2 py-1.5 text-center leading-tight font-semibold" data-pay-not-on-mesita>
          Not on
          <br />
          Mesita
        </span>
      )}
    </>
  );
  if (onMesita && hit.mesitaId) {
    return (
      <button type="button" onClick={() => onPick(hit.mesitaId!)} className="hover:bg-muted/60 flex w-full items-center gap-3 px-2.5 py-2.5 text-left" data-pay-search-hit>
        {row}
      </button>
    );
  }
  return (
    <div className="flex w-full items-center gap-3 px-2.5 py-2.5" data-pay-search-hit>
      {row}
    </div>
  );
}

/** Prepay's columns (Pato, 2026-11-24, MESITA-4845), a › ending every row
 *  (MESITA-4848). */
const PREPAY_HEADS = ["$200", "$1,000", "$5,000"];
const PREPAY_GRID = "grid w-full grid-cols-[46%_repeat(3,minmax(0,1fr))_1.5rem] items-center";
/** Pay is the name, then Accepts Credits (Pato, 2026-11-25, MESITA-4976).
 *  Cashback is hidden (2026-11-26). Extra discount is hidden too (Pato,
 *  2026-11-26, MESITA-5031): the percent still ranks Best offers, still
 *  filters, and still comes off the bill. The gap from the box to the sheet
 *  edge is the same 16px as the title and the search row (MESITA-4979). */
const PAY_GRID = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center";
const PAY_OFFERS = "grid grid-cols-[4rem] pr-4";
/** The bar that names Place and the three offers. Dark, on both lists. */
const HEAD_BAR = "bg-foreground text-background sticky top-0 z-10 text-xs font-semibold";

/** THE HIGHER THE BONUS, THE DARKER ITS PURPLE (Pato, 2026-11-24, MESITA-4860:
 *  "that way we can quickly spot the high bonuses"): Prepay's purple in four
 *  steps, by the percent itself, so a shade means the same in every row. */
function bonusShade(pct: number): string {
  if (pct >= 60) return "bg-[#352CB8] text-white";
  if (pct >= 40) return "bg-[#635BFF] text-white";
  if (pct >= 20) return "bg-[#BDB9FF] text-indigo-950";
  return "bg-[#E6E4FF] text-indigo-950";
}

/** A place, one row, the one button. */
function PlaceRow({ p, onPick, kind }: { p: PayPlace; onPick: (placeId: string) => void; kind: ListKind }) {
  return kind === "prepay" ? <PrepayRow p={p} onPick={onPick} /> : <PayRow p={p} onPick={onPick} />;
}

/** The bonus of each voucher it sells. No sale is a gray dash, not 0%
 *  (MESITA-4989): a dash means there is no prepayment. There is no 0% prepay. */
function PrepayRow({ p, onPick }: { p: PayPlace; onPick: (placeId: string) => void }) {
  const name = p.name ?? "A Mesita place";
  const bonuses = VOUCHERS_SHOWN.map((k) => {
    if (!p.offers?.sell.includes(k)) return null;
    const pct = voucherPct(p.offers, k);
    return pct > 0 ? pct : null;
  });
  const spoken = [name, ...bonuses.map((pct, i) => (pct ? `${PREPAY_HEADS[i]}, +${pct}% bonus` : null))];
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={spoken.filter(Boolean).join(", ")}
      className={cn(PREPAY_GRID, "hover:bg-muted/60 min-h-14 py-2 text-left transition-colors")}
      data-pay-pick-place
    >
      <span className="flex min-w-0 items-center gap-2 pr-1 pl-2.5">
        <PlacePhoto place={p} className="h-9 w-9 max-[359px]:hidden" />
        {/* The name alone, no address (Pato, 2026-11-24, MESITA-4861). */}
        <span className="line-clamp-2 min-w-0 text-sm leading-tight font-semibold">{name}</span>
      </span>
      {bonuses.map((pct, i) => (
        <span key={VOUCHERS_SHOWN[i]} className="flex justify-center">
          {pct ? (
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold tabular-nums max-[359px]:h-10 max-[359px]:w-10", bonusShade(pct))}>
              +{pct}%
            </span>
          ) : (
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold max-[359px]:h-10 max-[359px]:w-10", EMPTY_BOX)}>
              –
            </span>
          )}
        </span>
      ))}
      <ChevronRight className="text-muted-foreground h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** PAY IS ONE COLUMN (Pato, 2026-11-26, MESITA-5031): the name, then Accepts
 *  Credits. Extra discount and Cashback stay off this list. The gap from the
 *  box to the right edge is 16px (MESITA-4979). The header stays dark. Yes is
 *  blue, No is gray (MESITA-4977). Cashback still counts as accepting
 *  credits. The row selects the place. */
function PayRow({ p, onPick }: { p: PayPlace; onPick: (placeId: string) => void }) {
  const name = p.name ?? "A Mesita place";
  const accepts = payPlaceCashbackBps(p) > 0 || p.credits_ok === true;
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={`Select ${name}, Accepts Credits ${accepts ? "Yes" : "No"}`}
      className={cn(PAY_GRID, "hover:bg-muted/60 min-h-[72px] py-2 text-left transition-colors")}
      data-pay-pick-place
    >
      <span className="flex min-w-0 items-center gap-2 pr-4 pl-4">
        <PlacePhoto place={p} className="h-12 w-12 max-[359px]:hidden" />
        <span className="line-clamp-2 min-w-0 text-sm leading-tight font-semibold">{name}</span>
      </span>
      <span className={PAY_OFFERS}>
        <PayCell className={accepts ? "bg-[#BFDBFE] text-blue-950" : EMPTY_BOX}>{accepts ? "Yes" : "No"}</PayCell>
      </span>
    </button>
  );
}

/** No, and a percent that is off. Gray, so it stays a box on the white row. */
const EMPTY_BOX = "bg-muted text-muted-foreground";

function PayCell({ children, className }: { children: string; className: string }) {
  return (
    <span className={cn("flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold tabular-nums", className)} aria-hidden>
      {children}
    </span>
  );
}

function RowsSkeleton({ kind }: { kind: ListKind }) {
  return (
    <div className="border-border divide-border divide-y border-b" aria-busy>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("flex items-center px-3.5", kind === "pay" ? "h-[72px] gap-3" : "h-14 gap-2.5")}>
          <Skeleton className={cn("shrink-0 rounded-full", kind === "pay" ? "h-12 w-12" : "h-9 w-9")} />
          <Skeleton className="h-4 w-32" />
          <Skeleton className={cn("ml-auto", kind === "pay" ? "h-12 w-28 rounded-xl" : "h-4 w-28")} />
        </div>
      ))}
    </div>
  );
}
