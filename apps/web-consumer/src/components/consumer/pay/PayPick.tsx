"use client";

import { useState } from "react";
import { MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { voucherPct } from "@mesita/place-profile/lib/offers";
import { money, payPlaceCashbackBps, payPlaceDiscountBps, payPlaceTabs, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { PlacePhoto } from "./pay-common";
import type { Loc } from "./pay-location";

// THE WALLET'S TWO PLACE LISTS (MESITA-4838, Pato: "if i select prepay, then
// the box below displays all the prepay options ... if i select pay, then i
// see places to select below"): a search box and the places, in the menu's
// box. Prepay lists the places that sell credit, nearest first, with their
// vouchers; a row opens its Offers. Pay lists every place, the ones the guest
// holds credit at first, with their credits and what their next bill gets; a
// row opens the one QR with that place over it. The reads and the location
// are PayPage's, shared by both. They were a sheet (MESITA-4232), /wallet/buy
// (MESITA-4597), Nearby Offers (MESITA-4765) and /pay/pick (MESITA-4837).

type ListKind = "prepay" | "pay";

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
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const places = all && kind === "prepay" ? all.filter((p) => payPlaceTabs(p).prepay) : all;
  const matches = (places ?? []).filter((p) => !q || fold(p.name ?? "").includes(q));
  const shown =
    kind === "pay" ? [...matches.filter((p) => p.available_cents > 0), ...matches.filter((p) => p.available_cents <= 0)] : matches;
  return (
    <div className="flex flex-col" data-pay-list={kind}>
      {/* The whole row is the field (MESITA-4842), closed by the box's own line
          (Pato, MESITA-4844: "purple line, searchbar, purple line"). */}
      <div className={cn("bg-card sticky top-0 z-20 flex h-14 items-center border-b-[6px] pr-1 pl-4", kind === "prepay" ? "border-[#635BFF]" : "border-[#00D66F]")} data-pay-pick-search>
        <SearchBar
          query={query}
          showClear={query.length > 0}
          onQueryChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search a place"
        />
      </div>
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
      {places === null && failed ? (
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
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">
          {loc.state !== "on"
            ? "Turn on location to see places near you"
            : kind === "prepay"
              ? "No place near you sells credit yet"
              : "No Mesita place near you"}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground px-3.5 py-4 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
      ) : (
        // A PLACE TABLE (Pato, 2026-11-24, MESITA-4844: "this looks like three
        // different buttons ... it must look like place selector"): one row
        // per place, one tap; plain columns, no boxes.
        <div data-pay-places>
          <div className={cn(ROW_GRID[kind], "border-border bg-muted text-muted-foreground sticky top-14 z-10 border-b text-xs font-semibold", kind === "prepay" ? "h-11" : "h-9")} aria-hidden data-pay-head-row>
            <span className="pl-3.5">Place</span>
            {HEADS[kind].map((h) => (
              <span key={h} className={cn("text-center tabular-nums", kind === "prepay" && "text-foreground text-base max-[374px]:text-sm")}>
                {h}
              </span>
            ))}
          </div>
          <div className="divide-border border-border divide-y border-b">
            {shown.map((p, i) => (
              <PlaceRow key={`${p.place_id}:${i}`} p={p} onPick={onPick} kind={kind} />
            ))}
          </div>
        </div>
      )}
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

const VOUCHERS_SHOWN = ["voucher_200", "voucher_1000", "voucher_5000"] as const;

/** The table's columns (Pato, 2026-11-24, MESITA-4845: "name 50% and then
 *  prepay offers 50% wide, each 16.66%"): no ›, no gaps. Pay is thirds, with no
 *  distance (Pato: "33% and 33% and 33%"). */
const HEADS: Record<ListKind, string[]> = { prepay: ["$200", "$1,000", "$5,000"], pay: ["Your credits", "This bill"] };
const ROW_GRID: Record<ListKind, string> = {
  prepay: "grid w-full grid-cols-[50%_repeat(3,minmax(0,1fr))] items-center",
  pay: "grid w-full grid-cols-3 items-center",
};

/** A place, one row, the one button. Prepay: the bonus of each voucher it
 *  sells (– where it sells none). Pay: the guest's credits here and what their
 *  own next bill gets. */
function PlaceRow({ p, onPick, kind }: { p: PayPlace; onPick: (placeId: string) => void; kind: ListKind }) {
  const name = p.name ?? "A Mesita place";
  // Which branch it is (Pato, 2026-11-24, MESITA-4848).
  const address = kind === "prepay" ? p.address : null;
  const discount = payPlaceDiscountBps(p);
  const bps = discount || payPlaceCashbackBps(p);
  const offer = bps > 0 ? (discount > 0 ? "Discount" : "Cashback") : null;
  const bonuses = VOUCHERS_SHOWN.map((k) => (p.offers?.sell.includes(k) ? voucherPct(p.offers, k) : null));
  const credits = p.available_cents > 0 ? money(p.available_cents, p.currency) : null;
  const spoken =
    kind === "prepay"
      ? [name, address, ...bonuses.map((pct, i) => (pct === null ? null : `${HEADS.prepay[i]}, +${pct}% bonus`))]
      : [name, credits ? `${credits} in credits` : null, offer ? `${bps / 100}% ${offer} on this bill` : null];
  return (
    <button
      type="button"
      onClick={() => onPick(p.place_id)}
      aria-label={spoken.filter(Boolean).join(", ")}
      className={cn(ROW_GRID[kind], "hover:bg-muted/60 min-h-14 py-2 text-left transition-colors")}
      data-pay-pick-place
    >
      <span className={cn("flex min-w-0 items-center pr-1 pl-3.5", kind === "prepay" ? "gap-2.5" : "gap-2")}>
        <PlacePhoto place={p} className={kind === "prepay" ? "h-9 w-9 max-[359px]:hidden" : "h-8 w-8 max-[359px]:hidden"} />
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm leading-tight font-semibold">{name}</span>
          {address ? <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-tight">{address}</span> : null}
        </span>
      </span>
      {kind === "prepay" ? (
        bonuses.map((pct, i) => (
          <span key={VOUCHERS_SHOWN[i]} className={cn("text-center text-sm font-semibold tabular-nums", pct ? "text-indigo-700" : "text-muted-foreground")}>
            {pct ? `+${pct}%` : "–"}
          </span>
        ))
      ) : (
        <>
          <span className={cn("text-center text-sm leading-tight font-semibold tabular-nums max-[429px]:text-xs", credits ? "text-foreground" : "text-muted-foreground")}>
            {credits ?? "–"}
            {p.pending_cents > 0 ? <span className="text-muted-foreground block text-xs">+{money(p.pending_cents, p.currency)}</span> : null}
          </span>
          <span className={cn("text-center text-sm leading-tight font-semibold tabular-nums", offer ? "text-emerald-700" : "text-muted-foreground")}>
            {offer ? `${bps / 100}%` : "–"}
            {offer ? <span className="block text-xs">{offer}</span> : null}
          </span>
        </>
      )}
    </button>
  );
}

function RowsSkeleton() {
  return (
    <div className="border-border divide-border divide-y border-b" aria-busy>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-14 items-center gap-2.5 px-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="ml-auto h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
